import { envConfig } from "virtual:env-config";
import { promiseWithResolvers } from "./utils/misc";
import { isDevEnvironment } from "./utils/env";
import { createErrorMessage } from "./utils/error";
import { tryCatch } from "@monkeytype/util/trycatch";
import { addBanner } from "./states/banners";
import { setUserId, setUserVerified } from "./states/core";

/**
 * Authentication is delegated to ProgCompJOlivaApi: users sign in with their
 * ProgCompJOliva nickname + password and the returned access token is sent
 * as the Bearer token to the monkeytype backend.
 */

export type AuthUser = {
  /** monkeytype uid, derived from the ProgCompJOliva user id (see toMonkeytypeUid) */
  uid: string;
  nickname: string;
  email: string;
  emailVerified: boolean;
};

type StoredSession = {
  accessToken: string;
  accessTokenExpiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
};

type LoginResponse = StoredSession & { roles: string[] };

type ReadyCallback = (success: boolean, user: AuthUser | null) => Promise<void>;

const STORAGE_KEY = "progcompAuth";
// refresh the access token a bit before it actually expires
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

let session: StoredSession | null = null;
let rememberSession = false;
let currentUser: AuthUser | null = null;
let authStateCallback: ReadyCallback | undefined;
let refreshPromise: Promise<string | null> | null = null;
let initialized = false;
let hasNotified = false;

const { promise: authPromise, resolve: resolveAuthPromise } =
  promiseWithResolvers();

export async function init(callback: ReadyCallback): Promise<void> {
  try {
    authStateCallback = callback;
    initialized = true;

    loadSession();
    if (session !== null && isExpired(session.refreshTokenExpiresAtUtc, 0)) {
      clearSession();
    }

    // refresh an expired access token up front, this clears a rejected session
    if (session !== null) await getIdToken();

    await notifyAuthStateChanged();
  } catch (e) {
    initialized = false;
    console.error("Authentication failed to initialize", e);
    await callback(false, null);
    setUserState(null);
    if (isDevEnvironment()) {
      addBanner({
        level: "notice",
        text: "Dev Info: Authentication failed to initialize",
        icon: "fas fa-exclamation-triangle",
      });
    }
  } finally {
    resolveAuthPromise();
  }
}

/**
 *
 * @returns the current user if authenticated, else `null`
 */
export function getAuthenticatedUser(): AuthUser | null {
  return currentUser;
}

export function isAuthAvailable(): boolean {
  return initialized;
}

export async function signOut(): Promise<void> {
  console.log("auth signout");
  clearSession();
  await notifyAuthStateChanged();
}

export async function signInWithNicknameAndPassword(
  nickname: string,
  password: string,
  rememberMe: boolean,
): Promise<AuthUser> {
  if (!initialized) throw new Error("Authentication uninitialized");

  const result = await login(nickname, password, rememberMe);
  rememberSession = rememberMe;
  saveSession(result);
  await notifyAuthStateChanged();

  return currentUser as AuthUser;
}

/**
 * Checks the password of the signed in user by logging in again. On success the
 * session is replaced, so the next request carries a freshly issued token
 * (required by endpoints with `requireFreshToken`).
 */
export async function reauthenticateWithPassword(
  password: string,
): Promise<AuthUser> {
  const user = currentUser;
  if (user === null) throw new Error("User is not signed in");

  const result = await login(user.nickname, password, rememberSession);
  saveSession(result);
  currentUser = userFromToken(result.accessToken);
  return currentUser;
}

export function setUserState(
  options: {
    uid: string;
    emailVerified: boolean;
  } | null,
): void {
  if (options === null) {
    setUserId(null);
    setUserVerified(false);
  } else {
    setUserId(options.uid);
    setUserVerified(options.emailVerified);
  }
}

export async function getIdToken(): Promise<string | null> {
  if (session === null) return null;
  if (!isExpired(session.accessTokenExpiresAtUtc)) return session.accessToken;

  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = session?.refreshToken;
  if (refreshToken === undefined) return null;

  const { data: response, error } = await tryCatch(
    fetch(`${envConfig.progcompApiUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }),
  );

  if (error !== null) {
    // network error, keep the session so a later request can retry
    console.error("Failed to refresh access token", error);
    return null;
  }

  if (!response.ok) {
    // refresh token expired, revoked or user deactivated
    clearSession();
    void notifyAuthStateChanged();
    return null;
  }

  const result = (await response.json()) as LoginResponse;
  saveSession(result);
  return result.accessToken;
}

async function login(
  nickname: string,
  password: string,
  rememberMe: boolean,
): Promise<LoginResponse> {
  const { data: response, error } = await tryCatch(
    fetch(`${envConfig.progcompApiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname,
        password,
        sessionDuration: rememberMe ? "Thirty" : "One",
      }),
    }),
  );

  if (error !== null) {
    throw new Error(createErrorMessage(error, "ProgCompJOliva is unreachable"));
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      response.status === 401
        ? "Nickname or password is incorrect"
        : (body.error ?? `Login failed (${response.status})`),
    );
  }

  return (await response.json()) as LoginResponse;
}

async function notifyAuthStateChanged(): Promise<void> {
  const previousUid = currentUser?.uid;
  currentUser = session === null ? null : userFromToken(session.accessToken);
  if (hasNotified && previousUid === currentUser?.uid) return;
  hasNotified = true;

  setUserState(currentUser);
  await authStateCallback?.(true, currentUser);
}

function userFromToken(accessToken: string): AuthUser {
  const payload = decodeJwtPayload(accessToken);
  const claim = (name: string): string => {
    const value = payload[name];
    return typeof value === "string" ? value : "";
  };
  return {
    uid: toMonkeytypeUid(claim("sub")),
    nickname: claim("unique_name"),
    email: claim("email"),
    // email ownership is handled by ProgCompJOliva
    emailVerified: true,
  };
}

/**
 * ProgCompJOliva user ids are GUIDs, but monkeytype schemas only allow
 * [a-zA-Z0-9_] in uids, so the GUID is used without hyphens.
 * Keep in sync with `toMonkeytypeUid` in the backend's utils/auth.ts.
 */
function toMonkeytypeUid(progcompUserId: string): string {
  return progcompUserId.replace(/-/g, "").toLowerCase();
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1] ?? "";
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const json = new TextDecoder().decode(
    Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
  );
  return JSON.parse(json) as Record<string, unknown>;
}

function isExpired(
  expiresAtUtc: string,
  marginMs = ACCESS_TOKEN_REFRESH_MARGIN_MS,
): boolean {
  return new Date(expiresAtUtc).getTime() - marginMs <= Date.now();
}

function getStorage(remember: boolean): Storage {
  return remember ? window.localStorage : window.sessionStorage;
}

function loadSession(): void {
  for (const remember of [true, false]) {
    try {
      const raw = getStorage(remember).getItem(STORAGE_KEY);
      if (raw !== null) {
        session = JSON.parse(raw) as StoredSession;
        rememberSession = remember;
        return;
      }
    } catch (e) {
      console.error("Failed to load auth session", e);
    }
  }
}

function saveSession(result: StoredSession): void {
  session = {
    accessToken: result.accessToken,
    accessTokenExpiresAtUtc: result.accessTokenExpiresAtUtc,
    refreshToken: result.refreshToken,
    refreshTokenExpiresAtUtc: result.refreshTokenExpiresAtUtc,
  };
  try {
    getStorage(!rememberSession).removeItem(STORAGE_KEY);
    getStorage(rememberSession).setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.error("Failed to store auth session", e);
  }
}

function clearSession(): void {
  session = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear auth session", e);
  }
}

export { authPromise };
