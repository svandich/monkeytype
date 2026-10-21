import { PasswordSchema } from "@monkeytype/schemas/users";
import { tryCatch } from "@monkeytype/util/trycatch";
import { createMemo } from "solid-js";
import { ZodString } from "zod";

import { waitForPresetsReady } from "./collections/presets";
import { waitForTagsReady } from "./collections/tags";
import { updateFromServer as updateConfigFromServer } from "./config/remote";
import * as DB from "./db";
import { authEvent } from "./events/auth";
import {
  AuthUser,
  signOut as authSignOut,
  getAuthenticatedUser,
  isAuthAvailable,
  reauthenticateWithPassword,
  signInWithNicknameAndPassword,
} from "./progcomp-auth";
import * as Sentry from "./sentry";
import { getUserId, isAuthenticated, setUserId } from "./states/core";
import {
  showErrorNotification,
  showNoticeNotification,
} from "./states/notifications";
import { SnapshotInitError } from "./utils/snapshot-init-error";

/**
 * Accounts (nickname, email, password) live in ProgCompJOlivaApi.
 * Monkeytype only signs in with them, so there is no sign up, email or
 * password management here.
 */

export type AuthResult =
  | {
      success: true;
    }
  | {
      success: false;
      message: string;
    };

type ReauthSuccess = {
  status: "success";
  message: string;
  user: AuthUser;
};

type ReauthFailed = {
  status: "error" | "notice";
  message: string;
};

type ReauthenticateOptions = {
  password?: string;
};

export { getAuthenticatedUser };

const authenticatedUserEmail = createMemo(() => {
  getUserId();
  return getAuthenticatedUser()?.email ?? undefined;
});

export function getAuthenticatedUserEmailReactive(): string | undefined {
  return authenticatedUserEmail();
}

export async function sendVerificationEmail(): Promise<void> {
  showNoticeNotification(
    "Your email is managed by your ProgCompJOliva account",
  );
}

async function getDataAndInit(): Promise<boolean> {
  try {
    console.log("getting account data");
    const snapshot = await DB.initSnapshot();
    //TODO: preload collections for now, remove when __nonReactive is removed from collections
    await waitForPresetsReady();
    await waitForTagsReady();

    if (snapshot === false) {
      throw new Error(
        "Snapshot didn't initialize due to lacking authentication even though user is authenticated",
      );
    }

    void Sentry.setUser(snapshot.uid, snapshot.name);

    await updateConfigFromServer();
    return true;
  } catch (error) {
    console.error(error);
    if (error instanceof SnapshotInitError) {
      if (error.responseCode === 429) {
        showNoticeNotification(
          "Doing so will save you bandwidth, make the next test be ready faster and will not sign you out (which could mean your new personal best would not save to your account).",
          {
            durationMs: 0,
          },
        );
        showNoticeNotification(
          "You will run into this error if you refresh the website to restart the test. It is NOT recommended to do that. Instead, use tab + enter or just tab (with quick tab mode enabled) to restart the test.",
          {
            durationMs: 0,
          },
        );
      }

      showErrorNotification(`Failed to get user data: ${error.message}`);
    } else {
      showErrorNotification("Failed to get user data", { error });
    }
    return false;
  }
}

export async function loadUser(_user: AuthUser): Promise<void> {
  if (!(await getDataAndInit())) {
    signOut();
    return;
  }
  authEvent.dispatch({ type: "snapshotUpdated", data: { isInitial: true } });
}

export async function onAuthStateChanged(
  authInitialisedAndConnected: boolean,
  user: AuthUser | null,
): Promise<void> {
  console.debug(`account controller ready`);

  let userPromise: Promise<void> = Promise.resolve();

  if (authInitialisedAndConnected) {
    console.debug(`auth state changed, user ${user ? "true" : "false"}`);
    if (user) {
      setUserId(user.uid);
      userPromise = loadUser(user);
    } else {
      setUserId(null);
      DB.setSnapshot(undefined);
    }
  }

  if (!authInitialisedAndConnected || !user) {
    void Sentry.clearUser();
  }

  authEvent.dispatch({
    type: "authStateChanged",
    data: { isUserSignedIn: user !== null, loadPromise: userPromise },
  });
}

export async function signIn(
  nickname: string,
  password: string,
  rememberMe: boolean,
): Promise<AuthResult> {
  if (!isAuthAvailable()) {
    return { success: false, message: "Authentication uninitialized" };
  }

  const { error } = await tryCatch(
    signInWithNicknameAndPassword(nickname, password, rememberMe),
  );

  if (error !== null) {
    return { success: false, message: error.message };
  }
  return { success: true };
}

export function signOut(): void {
  if (!isAuthAvailable()) {
    showErrorNotification("Authentication uninitialized", { durationMs: 3000 });
    return;
  }
  if (!isAuthenticated()) return;
  void authSignOut();
}

/**
 * Confirms the password against ProgCompJOliva. Also renews the session, so
 * the next request carries a fresh token.
 */
export async function reauthenticate(
  options: ReauthenticateOptions,
): Promise<ReauthSuccess | ReauthFailed> {
  if (!isAuthAvailable()) {
    return {
      status: "error",
      message: "Authentication is not initialized",
    };
  }

  if (getAuthenticatedUser() === null) {
    return {
      status: "error",
      message: "User is not signed in",
    };
  }

  if (options.password === undefined) {
    return {
      status: "error",
      message: "Failed to reauthenticate using password: password missing.",
    };
  }

  const { data: user, error } = await tryCatch(
    reauthenticateWithPassword(options.password),
  );

  if (error !== null) {
    return { status: "notice", message: error.message };
  }

  return {
    status: "success",
    message: "Reauthenticated",
    user,
  };
}

/**
 * Returns the Zod schema for password validation. Passwords are only checked
 * against ProgCompJOliva, so it is lenient (just non-empty).
 */
export function getPasswordSchema(): ZodString {
  return PasswordSchema;
}

export function isUsingPasswordAuthentication(): boolean {
  return getAuthenticatedUser() !== null;
}
