import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ObjectId } from "mongodb";
import * as QuoteLeaderboardsDal from "../../../src/dal/quote-leaderboards";
import * as UserDal from "../../../src/dal/user";
import * as DB from "../../../src/init/db";
import { DBResult } from "../../../src/utils/result";
import { createUser } from "../../__testData__/users";
import { QUOTE_LEADERBOARD_MIN_QUOTES } from "@monkeytype/schemas/leaderboards";

describe("QuoteLeaderboardsDal", () => {
  beforeEach(() => {
    QuoteLeaderboardsDal.__testing.clearCache();
  });
  afterEach(async () => {
    await DB.collection("users").deleteMany({});
    await DB.collection("results").deleteMany({});
  });

  describe("get single quote", () => {
    it("should rank the best result of each user", async () => {
      //GIVEN
      const fast = await eligibleUser({
        progcomp: { nickname: "fast", organization: "UCH" },
      });
      const slow = await eligibleUser();
      const tied = await eligibleUser();
      await addResults(fast, "1", [80, 120, 100]);
      await addResults(slow, "1", [90]);
      await addResults(tied, "1", [90], { timestamp: 2000 });
      //other quotes and languages are ignored
      await addResults(slow, "2", [200]);
      await addResults(slow, "1", [200], { language: "english" });
      await addResults(slow, "1", [200], { mode: "words" });

      //WHEN
      const lb = await QuoteLeaderboardsDal.get("ariasctl", 1);

      //THEN
      expect(lb.map((it) => [it.uid, it.wpm, it.rank])).toEqual([
        [fast.uid, 120, 1],
        [slow.uid, 90, 2],
        [tied.uid, 90, 3],
      ]);
      expect(lb[0]).toEqual({
        uid: fast.uid,
        name: fast.name,
        wpm: 120,
        acc: 95,
        raw: 121,
        consistency: 80,
        timestamp: 1000,
        rank: 1,
        progcompNickname: "fast",
        organization: "UCH",
      });
    });

    it("should ignore unapplicable results and users", async () => {
      //GIVEN
      const applicable = await eligibleUser();
      await addResults(applicable, "1", [50]);
      await addResults(applicable, "1", [150], { bailedOut: true });
      await addResults(applicable, "1", [150], { lazyMode: true });
      for (const properties of [
        { banned: true },
        { lbOptOut: true },
        { needsToChangeName: true },
        { timeTyping: 0 },
      ]) {
        await addResults(await eligibleUser(properties), "1", [100]);
      }

      //WHEN
      const lb = await QuoteLeaderboardsDal.get("ariasctl", 1);

      //THEN
      expect(lb.map((it) => [it.uid, it.wpm])).toEqual([[applicable.uid, 50]]);
    });

    it("should filter by organization and users", async () => {
      //GIVEN
      const first = await eligibleUser();
      const second = await eligibleUser({
        progcomp: { nickname: "second", organization: "UCH" },
      });
      const third = await eligibleUser({
        progcomp: { nickname: "third", organization: "UCH" },
      });
      await addResults(first, "1", [100]);
      await addResults(second, "1", [90]);
      await addResults(third, "1", [80]);

      //WHEN
      const byOrganization = await QuoteLeaderboardsDal.get("ariasctl", 1, {
        organization: "UCH",
      });
      const byUids = await QuoteLeaderboardsDal.get("ariasctl", 1, {
        uids: [first.uid, third.uid],
      });

      //THEN
      expect(
        byOrganization.map((it) => [it.uid, it.rank, it.friendsRank]),
      ).toEqual([
        [second.uid, 2, 1],
        [third.uid, 3, 2],
      ]);
      expect(byUids.map((it) => [it.uid, it.rank, it.friendsRank])).toEqual([
        [first.uid, 1, 1],
        [third.uid, 3, 2],
      ]);
    });
  });

  describe("get overall", () => {
    it("should average the best result on each quote", async () => {
      //GIVEN
      const quotes = Array.from(
        { length: QUOTE_LEADERBOARD_MIN_QUOTES },
        (_, index) => `${index + 1}`,
      );
      const user = await eligibleUser();
      const other = await eligibleUser();
      const notEnoughQuotes = await eligibleUser();
      for (const [index, quote] of quotes.entries()) {
        await addResults(user, quote, [50, 100 + index], {
          timestamp: 1000 + index,
        });
        await addResults(other, quote, [90]);
      }
      await addResults(notEnoughQuotes, "1", [300]);

      //WHEN
      const lb = await QuoteLeaderboardsDal.get("ariasctl", undefined);

      //THEN
      expect(lb.map((it) => [it.uid, it.wpm, it.quotes, it.rank])).toEqual([
        [
          user.uid,
          100 + (QUOTE_LEADERBOARD_MIN_QUOTES - 1) / 2,
          QUOTE_LEADERBOARD_MIN_QUOTES,
          1,
        ],
        [other.uid, 90, QUOTE_LEADERBOARD_MIN_QUOTES, 2],
      ]);
      expect(lb[0]?.timestamp).toEqual(1000 + QUOTE_LEADERBOARD_MIN_QUOTES - 1);
    });
  });
});

async function eligibleUser(
  properties?: Partial<UserDal.DBUser>,
): Promise<UserDal.DBUser> {
  return createUser({ timeTyping: 7200, ...properties });
}

async function addResults(
  user: UserDal.DBUser,
  quoteId: string,
  wpms: number[],
  properties?: Partial<DBResult>,
): Promise<void> {
  await DB.collection<DBResult>("results").insertMany(
    wpms.map((wpm) => ({
      _id: new ObjectId(),
      uid: user.uid,
      name: user.name,
      wpm,
      rawWpm: wpm + 1,
      charStats: [0, 0, 0, 0],
      acc: 95,
      mode: "quote",
      mode2: quoteId,
      quoteLength: 1,
      timestamp: 1000,
      testDuration: 10,
      consistency: 80,
      keyConsistency: 80,
      chartData: "toolong",
      language: "ariasctl",
      ...properties,
    })),
  );
}
