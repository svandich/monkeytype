import crypto from "crypto";
import { LRUCache } from "lru-cache";
import {
  recordTokenCacheAccess,
  setTokenCacheLength,
  setTokenCacheSize,
} from "./prometheus";
import MonkeyError from "./error";

/**
 * Authentication is delegated to ProgCompJOlivaApi. Its access tokens are
 * ES256 JWTs: we verify them with the API's public key (fetched from
 * `GET /api/auth/jwks` and cached), so we can check tokens but never mint them,
 * and no call to the API is needed per request.
 */
export type DecodedIdToken = {
  uid: string;
  email: string;
  nickname: string;
  /** organization (university) short name, empty when the user has none */
  org: string;
  /** has the Admin role on ProgCompJOliva */
  isAdmin: boolean;
  iat: number;
  exp: number;
};

type JwtPayload = Record<string, unknown>;

type Jwk = crypto.JsonWebKey & { kid?: string; alg?: string; use?: string };

const DEFAULT_ISSUER = "ProgCompJOlivaApi";
const DEFAULT_AUDIENCE = "ProgCompJOlivaClient";
const ADMIN_ROLE = "Admin";
// the API writes ClaimTypes.Role unmapped, accept the short name as well
const ROLE_CLAIMS = [
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
  "role",
];
const CLOCK_SKEW_SECONDS = 60;
// refetch the key set periodically so a rotated-out key stops being accepted
const JWKS_MAX_AGE_MS = 60 * 60 * 1000;
// an unknown kid triggers a refetch (key rotation), at most this often
const JWKS_MIN_REFETCH_MS = 60 * 1000;
const JWKS_FETCH_TIMEOUT_MS = 10 * 1000;

let jwks = new Map<string, crypto.KeyObject>();
let jwksFetchedAt = 0;
let jwksFetchPromise: Promise<void> | null = null;

const tokenCache = new LRUCache<string, DecodedIdToken>({
  max: 20000,
  maxSize: 50000000, // 50MB
  sizeCalculation: (token, key): number =>
    JSON.stringify(token).length + key.length, //sizeInBytes
});

const TOKEN_CACHE_BUFFER = 1000 * 60 * 5; // 5 minutes

export function isAuthConfigured(): boolean {
  const url = process.env["PROGCOMP_API_URL"];
  return url !== undefined && url !== "";
}

function getJwksUrl(): string {
  const url = process.env["PROGCOMP_API_URL"];
  if (url === undefined || url === "") {
    throw new MonkeyError(
      503,
      "Authentication is not configured (PROGCOMP_API_URL is missing)",
    );
  }
  return `${url.replace(/\/+$/, "")}/api/auth/jwks`;
}

async function fetchJwks(): Promise<void> {
  const url = getJwksUrl();
  let body: { keys?: Jwk[] };
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(JWKS_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    body = (await response.json()) as { keys?: Jwk[] };
  } catch (e) {
    throw new MonkeyError(
      503,
      "Could not fetch the ProgCompJOliva signing keys",
      `${url}: ${(e as Error).message}`,
    );
  }

  const keys = new Map<string, crypto.KeyObject>();
  for (const jwk of body.keys ?? []) {
    if (jwk.kty !== "EC" || jwk.crv !== "P-256" || jwk.kid === undefined) {
      continue;
    }
    keys.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: "jwk" }));
  }
  jwks = keys;
  jwksFetchedAt = Date.now();
}

async function refreshJwks(): Promise<void> {
  jwksFetchPromise ??= fetchJwks().finally(() => {
    jwksFetchPromise = null;
  });
  return jwksFetchPromise;
}

async function getVerificationKey(kid: string): Promise<crypto.KeyObject> {
  const age = Date.now() - jwksFetchedAt;
  if (
    jwks.size === 0 ||
    age > JWKS_MAX_AGE_MS ||
    (!jwks.has(kid) && age > JWKS_MIN_REFETCH_MS)
  ) {
    await refreshJwks();
  }

  const key = jwks.get(kid);
  if (key === undefined) throw invalidToken(`unknown kid ${kid}`);
  return key;
}

/**
 * ProgCompJOliva user ids are GUIDs. Monkeytype schemas only allow
 * [a-zA-Z0-9_] in uids, so the uid is the GUID without hyphens (32 hex chars).
 * Keep in sync with `toMonkeytypeUid` in the frontend's progcomp-auth.ts.
 */
export function toMonkeytypeUid(progcompUserId: string): string {
  return progcompUserId.replace(/-/g, "").toLowerCase();
}

function base64UrlToBuffer(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function invalidToken(reason: string): MonkeyError {
  return new MonkeyError(401, "Invalid token", reason);
}

/**
 * Verifies a ProgCompJOlivaApi access token (signature, issuer, audience,
 * lifetime, token_use=access) and returns the relevant claims.
 */
async function decodeAndVerify(idToken: string): Promise<DecodedIdToken> {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new MonkeyError(400, "Incorrect Bearer token format");
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts as [
    string,
    string,
    string,
  ];

  let header: JwtPayload;
  let payload: JwtPayload;
  try {
    header = JSON.parse(
      base64UrlToBuffer(encodedHeader).toString("utf8"),
    ) as JwtPayload;
    payload = JSON.parse(
      base64UrlToBuffer(encodedPayload).toString("utf8"),
    ) as JwtPayload;
  } catch {
    throw new MonkeyError(400, "Incorrect Bearer token format");
  }

  // only ES256 is accepted, never "none" or an HMAC alg
  if (header["alg"] !== "ES256") {
    throw invalidToken(`unsupported alg ${String(header["alg"])}`);
  }
  const kid = header["kid"];
  if (typeof kid !== "string" || kid === "") {
    throw invalidToken("missing kid");
  }

  const isSignatureValid = crypto.verify(
    "sha256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    // JWS ES256 signatures are raw r||s, not DER
    { key: await getVerificationKey(kid), dsaEncoding: "ieee-p1363" },
    base64UrlToBuffer(encodedSignature),
  );
  if (!isSignatureValid) {
    throw invalidToken("bad signature");
  }

  const issuer = process.env["PROGCOMP_JWT_ISSUER"] ?? DEFAULT_ISSUER;
  const audience = process.env["PROGCOMP_JWT_AUDIENCE"] ?? DEFAULT_AUDIENCE;
  const aud = payload["aud"];
  const audiences = Array.isArray(aud) ? aud : [aud];

  if (payload["iss"] !== issuer) throw invalidToken("bad issuer");
  if (!audiences.includes(audience)) throw invalidToken("bad audience");
  // refresh tokens share the signing key, only access tokens may authenticate
  if (payload["token_use"] !== "access") {
    throw invalidToken("not an access token");
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = Number(payload["exp"]);
  const nbf = Number(payload["nbf"] ?? 0);
  if (!Number.isFinite(exp) || exp + CLOCK_SKEW_SECONDS < now) {
    throw new MonkeyError(401, "Token expired - please login again");
  }
  if (nbf - CLOCK_SKEW_SECONDS > now) {
    throw invalidToken("token not yet valid");
  }

  const sub = payload["sub"];
  if (typeof sub !== "string" || sub === "") {
    throw invalidToken("missing sub");
  }
  const uid = toMonkeytypeUid(sub);

  const email = payload["email"];
  const nickname = payload["unique_name"];
  const org = payload["org"];
  // a single role is a string, several are an array
  const roles = ROLE_CLAIMS.flatMap((claim) => [payload[claim] ?? []].flat());

  return {
    uid,
    email: typeof email === "string" ? email.toLowerCase() : "",
    nickname: typeof nickname === "string" ? nickname : "",
    org: typeof org === "string" ? org : "",
    isAdmin: roles.includes(ADMIN_ROLE),
    iat: Number(payload["iat"] ?? nbf),
    exp,
  };
}

export async function verifyIdToken(
  idToken: string,
  noCache = false,
): Promise<DecodedIdToken> {
  if (noCache) {
    return await decodeAndVerify(idToken);
  }

  setTokenCacheLength(tokenCache.size);
  setTokenCacheSize(tokenCache.calculatedSize ?? 0);

  const cached = tokenCache.get(idToken);

  if (cached) {
    const expirationDate = cached.exp * 1000 - TOKEN_CACHE_BUFFER;

    if (expirationDate < Date.now()) {
      recordTokenCacheAccess("hit_expired");
      tokenCache.delete(idToken);
    } else {
      recordTokenCacheAccess("hit");
      return cached;
    }
  } else {
    recordTokenCacheAccess("miss");
  }

  const decoded = await decodeAndVerify(idToken);
  tokenCache.set(idToken, decoded);
  return decoded;
}

/**
 * Drops cached tokens of the user. ProgCompJOlivaApi tokens are stateless, so
 * they stay valid until they expire (at most 1 hour for access tokens).
 */
export async function revokeTokensByUid(uid: string): Promise<void> {
  for (const entry of tokenCache.entries()) {
    if (entry[1].uid === uid) {
      tokenCache.delete(entry[0]);
    }
  }
}

export function throwManagedByProgComp(action: string): never {
  throw new MonkeyError(
    400,
    `${action} is managed by your ProgCompJOliva account. Please change it there.`,
  );
}
