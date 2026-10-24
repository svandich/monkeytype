import { Document } from "mongodb";
import {
  QUOTE_LEADERBOARD_MIN_QUOTES,
  QuoteLeaderboardEntry,
} from "@monkeytype/schemas/leaderboards";
import { getCachedConfiguration } from "../init/configuration";
import { isDevEnvironment } from "../utils/misc";
import { getResultCollection } from "./result";
import { DBUser } from "./user";

/**
 * Quote leaderboards are built from the results collection on demand (quote
 * personal bests are not stored), and cached for a short time.
 */
const CACHE_TTL_MILLISECONDS = 60 * 1000;

const cache = new Map<
  string,
  { expiresAt: number; entries: Promise<QuoteLeaderboardEntry[]> }
>();

type BestResult = {
  _id: string;
  wpm: number;
  acc: number;
  raw: number;
  consistency: number;
  timestamp: number;
  quotes?: number;
  user: Pick<
    DBUser,
    "name" | "discordId" | "discordAvatar" | "inventory" | "progcomp"
  >;
};

/**
 * @param quoteId leaderboard of a single quote, undefined for the overall quote leaderboard
 * @param filter only include these users or this organization, their rank within it is in `friendsRank`
 */
export async function get(
  language: string,
  quoteId: number | undefined,
  filter?: { uids?: string[]; organization?: string },
): Promise<QuoteLeaderboardEntry[]> {
  const entries = await getCached(language, quoteId);

  if (filter?.uids === undefined && filter?.organization === undefined) {
    return entries;
  }

  const uids = filter.uids !== undefined ? new Set(filter.uids) : undefined;
  return entries
    .filter(
      (it) =>
        (uids === undefined || uids.has(it.uid)) &&
        (filter.organization === undefined ||
          it.organization === filter.organization),
    )
    .map((it, index) => ({ ...it, friendsRank: index + 1 }));
}

async function getCached(
  language: string,
  quoteId: number | undefined,
): Promise<QuoteLeaderboardEntry[]> {
  const key = `${language}_${quoteId ?? "all"}`;
  const cached = cache.get(key);
  if (cached !== undefined && cached.expiresAt > Date.now()) {
    return cached.entries;
  }

  const entries = build(language, quoteId);
  cache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MILLISECONDS,
    entries,
  });
  entries.catch(() => cache.delete(key));
  return entries;
}

async function build(
  language: string,
  quoteId: number | undefined,
): Promise<QuoteLeaderboardEntry[]> {
  const minTimeTyping = (await getCachedConfiguration(true)).leaderboards
    .minTimeTyping;

  const pipeline: Document[] = [
    {
      $match: {
        mode: "quote",
        language,
        ...(quoteId !== undefined ? { mode2: `${quoteId}` } : {}),
        bailedOut: { $ne: true },
        lazyMode: { $ne: true },
      },
    },
    { $sort: { wpm: -1, acc: -1, timestamp: 1 } },
    // best result of each user on each quote
    {
      $group: {
        _id: { uid: "$uid", quote: "$mode2" },
        wpm: { $first: "$wpm" },
        acc: { $first: "$acc" },
        raw: { $first: "$rawWpm" },
        consistency: { $first: "$consistency" },
        timestamp: { $first: "$timestamp" },
      },
    },
    ...(quoteId !== undefined
      ? [{ $addFields: { _id: "$_id.uid" } }]
      : [
          {
            $group: {
              _id: "$_id.uid",
              wpm: { $avg: "$wpm" },
              acc: { $avg: "$acc" },
              raw: { $avg: "$raw" },
              consistency: { $avg: "$consistency" },
              timestamp: { $max: "$timestamp" },
              quotes: { $sum: 1 },
            },
          },
          { $match: { quotes: { $gte: QUOTE_LEADERBOARD_MIN_QUOTES } } },
          {
            $addFields: {
              wpm: { $round: ["$wpm", 2] },
              acc: { $round: ["$acc", 2] },
              raw: { $round: ["$raw", 2] },
              consistency: { $round: ["$consistency", 2] },
            },
          },
        ]),
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "uid",
        as: "user",
        pipeline: [
          {
            $match: {
              banned: { $ne: true },
              lbOptOut: { $ne: true },
              needsToChangeName: { $ne: true },
              timeTyping: { $gt: isDevEnvironment() ? 0 : minTimeTyping },
            },
          },
          {
            $project: {
              _id: 0,
              name: 1,
              discordId: 1,
              discordAvatar: 1,
              "inventory.badges": 1,
              progcomp: 1,
            },
          },
        ],
      },
    },
    { $unwind: "$user" },
    { $sort: { wpm: -1, acc: -1, timestamp: 1 } },
  ];

  const results = await getResultCollection()
    .aggregate<BestResult>(pipeline, { allowDiskUse: true })
    .toArray();

  return results.map(({ _id, user, ...best }, index) => ({
    ...best,
    uid: _id,
    name: user.name,
    discordId: user.discordId,
    discordAvatar: user.discordAvatar,
    badgeId: user.inventory?.badges?.find((it) => it.selected)?.id,
    progcompNickname: user.progcomp?.nickname,
    organization: user.progcomp?.organization,
    rank: index + 1,
  }));
}

export async function createIndicies(): Promise<void> {
  await getResultCollection().createIndex(
    { language: 1, mode2: 1, wpm: -1, acc: -1, timestamp: 1 },
    { partialFilterExpression: { mode: "quote" } },
  );
}

export const __testing = {
  clearCache: (): void => cache.clear(),
};
