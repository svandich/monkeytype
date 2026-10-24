import { MonkeyResponse } from "../../utils/monkey-response";
import * as LeaderboardsDAL from "../../dal/leaderboards";
import * as QuoteLeaderboardsDAL from "../../dal/quote-leaderboards";
import * as ConnectionsDal from "../../dal/connections";
import MonkeyError from "../../utils/error";
import * as DailyLeaderboards from "../../utils/daily-leaderboards";
import * as WeeklyXpLeaderboard from "../../services/weekly-xp-leaderboard";
import {
  DailyLeaderboardQuery,
  GetDailyLeaderboardQuery,
  GetDailyLeaderboardRankQuery,
  GetDailyLeaderboardResponse,
  GetLeaderboardDailyRankResponse,
  GetLeaderboardQuery,
  GetLeaderboardRankQuery,
  GetLeaderboardRankResponse,
  GetLeaderboardResponse,
  GetOrganizationLeaderboardQuery,
  GetOrganizationLeaderboardResponse,
  GetQuoteLeaderboardQuery,
  GetQuoteLeaderboardRankQuery,
  GetQuoteLeaderboardRankResponse,
  GetQuoteLeaderboardResponse,
  QuoteLeaderboardQuery,
  GetWeeklyXpLeaderboardQuery,
  GetWeeklyXpLeaderboardRankQuery,
  GetWeeklyXpLeaderboardRankResponse,
  GetWeeklyXpLeaderboardResponse,
} from "@monkeytype/contracts/leaderboards";
import { Configuration } from "@monkeytype/schemas/configuration";
import {
  isAllTimeLeaderboardLanguage,
  isQuoteLeaderboardLanguage,
} from "@monkeytype/schemas/leaderboards";
import {
  getCurrentDayTimestamp,
  getCurrentWeekTimestamp,
  MILLISECONDS_IN_DAY,
} from "@monkeytype/util/date-and-time";
import { MonkeyRequest } from "../types";
import { omit } from "../../utils/misc";

export async function getLeaderboard(
  req: MonkeyRequest<GetLeaderboardQuery>,
): Promise<GetLeaderboardResponse> {
  const { language, mode, mode2, page, pageSize, friendsOnly, organization } =
    req.query;
  const { uid } = req.ctx.decodedToken;
  const connectionsConfig = req.ctx.configuration.connections;

  assertAllTimeLeaderboardExists(mode, mode2, language);

  // organization and friends filters don't combine, organization wins
  const friendsOnlyUid =
    organization === undefined
      ? getFriendsOnlyUid(uid, friendsOnly, connectionsConfig)
      : undefined;

  const leaderboard = await LeaderboardsDAL.get(
    mode,
    mode2,
    language,
    page,
    pageSize,
    req.ctx.configuration.users.premium.enabled,
    friendsOnlyUid,
    organization,
  );

  if (leaderboard === false) {
    throw new MonkeyError(
      503,
      "Leaderboard is currently updating. Please try again in a few seconds.",
    );
  }

  const count = await LeaderboardsDAL.getCount(
    mode,
    mode2,
    language,
    friendsOnlyUid,
    organization,
  );
  const normalizedLeaderboard = leaderboard.map((it) => omit(it, ["_id"]));

  return new MonkeyResponse("Leaderboard retrieved", {
    count,
    entries: normalizedLeaderboard,
    pageSize,
  });
}

export async function getRankFromLeaderboard(
  req: MonkeyRequest<GetLeaderboardRankQuery>,
): Promise<GetLeaderboardRankResponse> {
  const { language, mode, mode2, friendsOnly, organization } = req.query;
  const { uid } = req.ctx.decodedToken;
  const connectionsConfig = req.ctx.configuration.connections;

  const data = await LeaderboardsDAL.getRank(
    mode,
    mode2,
    language,
    uid,
    getFriendsOnlyUid(uid, friendsOnly, connectionsConfig) !== undefined,
    organization,
  );
  if (data === false) {
    throw new MonkeyError(
      503,
      "Leaderboard is currently updating. Please try again in a few seconds.",
    );
  }

  if (data === null) {
    return new MonkeyResponse("Rank retrieved", null);
  }

  return new MonkeyResponse("Rank retrieved", omit(data, ["_id"]));
}

export async function getOrganizationLeaderboard(
  req: MonkeyRequest<GetOrganizationLeaderboardQuery>,
): Promise<GetOrganizationLeaderboardResponse> {
  const { language, mode, mode2 } = req.query;

  assertAllTimeLeaderboardExists(mode, mode2, language);

  const entries = await LeaderboardsDAL.getOrganizations(mode, mode2, language);

  return new MonkeyResponse("Organization leaderboard retrieved", entries);
}

export async function getQuoteLeaderboard(
  req: MonkeyRequest<GetQuoteLeaderboardQuery>,
): Promise<GetQuoteLeaderboardResponse> {
  const { page, pageSize } = req.query;

  const entries = await getQuoteLeaderboardEntries(req);

  return new MonkeyResponse("Quote leaderboard retrieved", {
    count: entries.length,
    entries: entries.slice(page * pageSize, (page + 1) * pageSize),
    pageSize,
  });
}

export async function getQuoteLeaderboardRank(
  req: MonkeyRequest<GetQuoteLeaderboardRankQuery>,
): Promise<GetQuoteLeaderboardRankResponse> {
  const { uid } = req.ctx.decodedToken;

  const entries = await getQuoteLeaderboardEntries(req);

  return new MonkeyResponse(
    "Rank retrieved",
    entries.find((it) => it.uid === uid) ?? null,
  );
}

async function getQuoteLeaderboardEntries(
  req: MonkeyRequest<QuoteLeaderboardQuery>,
): ReturnType<typeof QuoteLeaderboardsDAL.get> {
  const { language, quoteId, friendsOnly, organization } = req.query;
  const { uid } = req.ctx.decodedToken;

  if (!isQuoteLeaderboardLanguage(language)) {
    throw new MonkeyError(
      404,
      "There is no quote leaderboard for this language",
    );
  }

  // organization and friends filters don't combine, organization wins
  const friendUids =
    organization === undefined
      ? await getFriendsUids(
          uid,
          friendsOnly === true,
          req.ctx.configuration.connections,
        )
      : undefined;

  return QuoteLeaderboardsDAL.get(language, quoteId, {
    uids: friendUids !== undefined ? [...friendUids, uid] : undefined,
    organization,
  });
}

function assertAllTimeLeaderboardExists(
  mode: string,
  mode2: string,
  language: string,
): void {
  if (
    mode !== "time" ||
    (mode2 !== "15" && mode2 !== "60") ||
    !isAllTimeLeaderboardLanguage(language)
  ) {
    throw new MonkeyError(404, "There is no leaderboard for this mode");
  }
}

function getDailyLeaderboardWithError(
  { language, mode, mode2, daysBefore }: DailyLeaderboardQuery,
  config: Configuration["dailyLeaderboards"],
): DailyLeaderboards.DailyLeaderboard {
  const customTimestamp =
    daysBefore === undefined
      ? -1
      : getCurrentDayTimestamp() - daysBefore * MILLISECONDS_IN_DAY;

  const dailyLeaderboard = DailyLeaderboards.getDailyLeaderboard(
    language,
    mode,
    mode2,
    config,
    customTimestamp,
  );
  if (!dailyLeaderboard) {
    throw new MonkeyError(404, "There is no daily leaderboard for this mode");
  }

  return dailyLeaderboard;
}

export async function getDailyLeaderboard(
  req: MonkeyRequest<GetDailyLeaderboardQuery>,
): Promise<GetDailyLeaderboardResponse> {
  const { page, pageSize, friendsOnly } = req.query;
  const { uid } = req.ctx.decodedToken;
  const connectionsConfig = req.ctx.configuration.connections;

  const friendUids = await getFriendsUids(
    uid,
    friendsOnly === true,
    connectionsConfig,
  );

  const dailyLeaderboard = getDailyLeaderboardWithError(
    req.query,
    req.ctx.configuration.dailyLeaderboards,
  );

  const results = await dailyLeaderboard.getResults(
    page,
    pageSize,
    req.ctx.configuration.dailyLeaderboards,
    req.ctx.configuration.users.premium.enabled,
    friendUids,
  );

  return new MonkeyResponse("Daily leaderboard retrieved", {
    entries: results?.entries ?? [],
    count: results?.count ?? 0,
    minWpm: results?.minWpm ?? 0,
    pageSize,
  });
}

export async function getDailyLeaderboardRank(
  req: MonkeyRequest<GetDailyLeaderboardRankQuery>,
): Promise<GetLeaderboardDailyRankResponse> {
  const { friendsOnly } = req.query;
  const { uid } = req.ctx.decodedToken;
  const connectionsConfig = req.ctx.configuration.connections;

  const friendUids = await getFriendsUids(
    uid,
    friendsOnly === true,
    connectionsConfig,
  );

  const dailyLeaderboard = getDailyLeaderboardWithError(
    req.query,
    req.ctx.configuration.dailyLeaderboards,
  );

  const rank = await dailyLeaderboard.getRank(
    uid,
    req.ctx.configuration.dailyLeaderboards,
    friendUids,
  );

  return new MonkeyResponse("Daily leaderboard rank retrieved", rank);
}

function getWeeklyXpLeaderboardWithError(
  config: Configuration["leaderboards"]["weeklyXp"],
  weeksBefore?: number,
): WeeklyXpLeaderboard.WeeklyXpLeaderboard {
  const customTimestamp =
    weeksBefore === undefined
      ? -1
      : getCurrentWeekTimestamp() - weeksBefore * MILLISECONDS_IN_DAY * 7;

  const weeklyXpLeaderboard = WeeklyXpLeaderboard.get(config, customTimestamp);
  if (!weeklyXpLeaderboard) {
    throw new MonkeyError(404, "XP leaderboard for this week not found.");
  }

  return weeklyXpLeaderboard;
}

export async function getWeeklyXpLeaderboard(
  req: MonkeyRequest<GetWeeklyXpLeaderboardQuery>,
): Promise<GetWeeklyXpLeaderboardResponse> {
  const { page, pageSize, weeksBefore, friendsOnly } = req.query;

  const { uid } = req.ctx.decodedToken;
  const connectionsConfig = req.ctx.configuration.connections;

  const friendUids = await getFriendsUids(
    uid,
    friendsOnly === true,
    connectionsConfig,
  );

  const weeklyXpLeaderboard = getWeeklyXpLeaderboardWithError(
    req.ctx.configuration.leaderboards.weeklyXp,
    weeksBefore,
  );
  const results = await weeklyXpLeaderboard.getResults(
    page,
    pageSize,
    req.ctx.configuration.leaderboards.weeklyXp,
    req.ctx.configuration.users.premium.enabled,
    friendUids,
  );

  return new MonkeyResponse("Weekly xp leaderboard retrieved", {
    entries: results?.entries ?? [],
    count: results?.count ?? 0,
    pageSize,
  });
}

export async function getWeeklyXpLeaderboardRank(
  req: MonkeyRequest<GetWeeklyXpLeaderboardRankQuery>,
): Promise<GetWeeklyXpLeaderboardRankResponse> {
  const { friendsOnly } = req.query;
  const { uid } = req.ctx.decodedToken;
  const connectionsConfig = req.ctx.configuration.connections;

  const friendUids = await getFriendsUids(
    uid,
    friendsOnly === true,
    connectionsConfig,
  );

  const weeklyXpLeaderboard = getWeeklyXpLeaderboardWithError(
    req.ctx.configuration.leaderboards.weeklyXp,
    req.query.weeksBefore,
  );
  const rankEntry = await weeklyXpLeaderboard.getRank(
    uid,
    req.ctx.configuration.leaderboards.weeklyXp,
    friendUids,
  );

  return new MonkeyResponse("Weekly xp leaderboard rank retrieved", rankEntry);
}

async function getFriendsUids(
  uid: string,
  friendsOnly: boolean,
  friendsConfig: Configuration["connections"],
): Promise<string[] | undefined> {
  if (uid !== "" && friendsOnly) {
    if (!friendsConfig.enabled) {
      throw new MonkeyError(503, "This feature is currently unavailable.");
    }
    return await ConnectionsDal.getFriendsUids(uid);
  }
  return undefined;
}

function getFriendsOnlyUid(
  uid: string,
  friendsOnly: boolean | undefined,
  friendsConfig: Configuration["connections"],
): string | undefined {
  if (uid !== "" && friendsOnly === true) {
    if (!friendsConfig.enabled) {
      throw new MonkeyError(503, "This feature is currently unavailable.");
    }
    return uid;
  }
  return undefined;
}
