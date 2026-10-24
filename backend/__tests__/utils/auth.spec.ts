import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import crypto from "crypto";
import { IdSchema } from "@monkeytype/schemas/util";
import { toMonkeytypeUid, verifyIdToken } from "../../src/utils/auth";

const ROLE_CLAIM =
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

describe("auth", () => {
  describe("toMonkeytypeUid", () => {
    it("should strip the hyphens of a ProgCompJOliva guid", () => {
      expect(toMonkeytypeUid("0B6F3A1E-1111-2222-3333-444455556666")).toEqual(
        "0b6f3a1e111122223333444455556666",
      );
    });

    it("should produce a uid accepted by the monkeytype schemas", () => {
      const uid = toMonkeytypeUid("0b6f3a1e-1111-2222-3333-444455556666");
      expect(IdSchema.safeParse(uid).success).toBe(true);
    });
  });

  describe("verifyIdToken", () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    const kid = "test-key";

    function signToken(claims: Record<string, unknown>): string {
      const now = Math.floor(Date.now() / 1000);
      const encode = (value: object): string =>
        Buffer.from(JSON.stringify(value)).toString("base64url");
      const header = encode({ alg: "ES256", kid, typ: "JWT" });
      const payload = encode({
        sub: "0b6f3a1e-1111-2222-3333-444455556666",
        unique_name: "Bob",
        email: "Bob@mail.com",
        token_use: "access",
        iss: "ProgCompJOlivaApi",
        aud: "ProgCompJOlivaClient",
        nbf: now,
        exp: now + 3600,
        ...claims,
      });
      const signature = crypto
        .sign("sha256", Buffer.from(`${header}.${payload}`), {
          key: privateKey,
          dsaEncoding: "ieee-p1363",
        })
        .toString("base64url");
      return `${header}.${payload}.${signature}`;
    }

    beforeAll(() => {
      vi.stubEnv("PROGCOMP_API_URL", "http://progcomp.test");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              keys: [{ ...publicKey.export({ format: "jwk" }), kid }],
            }),
          ),
        ),
      );
    });
    afterAll(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it("should decode the ProgCompJOliva claims", async () => {
      const token = await verifyIdToken(signToken({ org: "UCH" }), true);
      expect(token).toMatchObject({
        uid: "0b6f3a1e111122223333444455556666",
        email: "bob@mail.com",
        nickname: "Bob",
        org: "UCH",
        isAdmin: false,
      });
    });

    it.each([
      ["a single role", { [ROLE_CLAIM]: "Admin" }],
      ["several roles", { [ROLE_CLAIM]: ["User", "Admin"] }],
      ["the short role claim", { role: "Admin" }],
    ])("should detect the Admin role with %s", async (_, claims) => {
      const token = await verifyIdToken(signToken(claims), true);
      expect(token.isAdmin).toBe(true);
    });

    it("should not treat other roles as admin", async () => {
      const token = await verifyIdToken(
        signToken({ [ROLE_CLAIM]: ["User", "ProblemSetter"] }),
        true,
      );
      expect(token.isAdmin).toBe(false);
    });
  });
});
