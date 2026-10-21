import { describe, it, expect } from "vitest";
import { IdSchema } from "@monkeytype/schemas/util";
import { toMonkeytypeUid } from "../../src/utils/auth";

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
});
