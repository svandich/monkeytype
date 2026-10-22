import { describe, it, expect } from "vitest";
import {
  getTypingPersonalBests,
  toProgcompUserId,
} from "../../src/services/progcomp-sync";
import { pb } from "../__testData__/users";
import { PersonalBest } from "@monkeytype/schemas/shared";

describe("progcomp-sync", () => {
  describe("toProgcompUserId", () => {
    it("restores the hyphens of the ProgCompJOliva GUID", () => {
      expect(toProgcompUserId("0b3f5e1ca2d84f7e9c1b2a3d4e5f6a7b")).toEqual(
        "0b3f5e1c-a2d8-4f7e-9c1b-2a3d4e5f6a7b",
      );
    });
    it("ignores uids that are not GUIDs", () => {
      expect(toProgcompUserId("6ad8c907ba77839c9141ab9e")).toBeUndefined();
    });
  });

  describe("getTypingPersonalBests", () => {
    const withLanguage = (best: PersonalBest, language: string): PersonalBest =>
      ({ ...best, language }) as PersonalBest;

    it("keeps the best leaderboard-eligible result per mode and language", () => {
      const result = getTypingPersonalBests({
        time: {
          "60": [
            withLanguage(pb(80), "ariasctl"),
            withLanguage(pb(90), "ariasctl"),
            pb(70),
            // not leaderboard-eligible
            { ...withLanguage(pb(150), "ariasctl"), punctuation: true },
            { ...withLanguage(pb(150), "ariasctl"), numbers: true },
            { ...withLanguage(pb(150), "ariasctl"), lazyMode: true },
            { ...withLanguage(pb(150), "ariasctl"), difficulty: "expert" },
          ],
        },
        words: { "25": [pb(100)] },
        quote: {},
        zen: {},
        custom: {},
      });

      expect(result).toEqual([
        expect.objectContaining({
          mode: "time",
          mode2: "60",
          language: "ariasctl",
          wpm: 90,
        }),
        expect.objectContaining({
          mode: "time",
          mode2: "60",
          language: "english",
          wpm: 70,
        }),
        expect.objectContaining({
          mode: "words",
          mode2: "25",
          language: "english",
          wpm: 100,
        }),
      ]);
    });

    it("handles users without personal bests", () => {
      expect(getTypingPersonalBests(undefined)).toEqual([]);
    });
  });
});
