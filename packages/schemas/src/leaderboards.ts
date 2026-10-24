import { z } from "zod";
import { Language } from "./languages";

/**
 * Languages with an all-time leaderboard (time 15 and 60). The first one is the
 * default selection on the leaderboard page.
 */
export const ALL_TIME_LEADERBOARD_LANGUAGES = [
  "ariasctl",
  "english",
] as const satisfies Language[];

export function isAllTimeLeaderboardLanguage(language: string): boolean {
  return (ALL_TIME_LEADERBOARD_LANGUAGES as readonly string[]).includes(
    language,
  );
}

/**
 * Languages with a quote leaderboard. The first one is the default selection on
 * the leaderboard page.
 */
export const QUOTE_LEADERBOARD_LANGUAGES = [
  "ariasctl",
] as const satisfies Language[];

export function isQuoteLeaderboardLanguage(language: string): boolean {
  return (QUOTE_LEADERBOARD_LANGUAGES as readonly string[]).includes(language);
}

/** how many different quotes a user needs to type to be on the overall quote leaderboard */
export const QUOTE_LEADERBOARD_MIN_QUOTES = 5;

const FriendsRankSchema = z
  .number()
  .nonnegative()
  .int()
  .optional()
  .describe("only available on friendsOnly leaderboard");

export const LeaderboardEntrySchema = z.object({
  wpm: z.number().nonnegative(),
  acc: z.number().nonnegative().min(0).max(100),
  timestamp: z.number().int().nonnegative(),
  raw: z.number().nonnegative(),
  consistency: z.number().nonnegative().optional(),
  uid: z.string(),
  name: z.string(),
  discordId: z.string().optional(),
  discordAvatar: z.string().optional(),
  rank: z.number().nonnegative().int(),
  friendsRank: FriendsRankSchema,
  badgeId: z.number().int().optional(),
  isPremium: z.boolean().optional(),
  progcompNickname: z.string().optional(),
  organization: z
    .string()
    .optional()
    .describe("organization (university) short name"),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const QuoteLeaderboardEntrySchema = LeaderboardEntrySchema.extend({
  quotes: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "number of different quotes the averages are taken over, overall leaderboard only",
    ),
});
export type QuoteLeaderboardEntry = z.infer<typeof QuoteLeaderboardEntrySchema>;

/** how many of an organization's best typists make up its score, like an ICPC team */
export const ORGANIZATION_TEAM_SIZE = 3;

export const OrganizationLeaderboardEntrySchema = z.object({
  rank: z.number().nonnegative().int(),
  organization: z.string().describe("organization (university) short name"),
  score: z
    .number()
    .nonnegative()
    .describe(
      "average wpm of the organization's best typists, missing ones count as 0",
    ),
  members: z.number().int().nonnegative(),
  team: z.array(
    LeaderboardEntrySchema.pick({
      uid: true,
      name: true,
      wpm: true,
      acc: true,
      rank: true,
      progcompNickname: true,
    }),
  ),
});
export type OrganizationLeaderboardEntry = z.infer<
  typeof OrganizationLeaderboardEntrySchema
>;

export const RedisDailyLeaderboardEntrySchema = LeaderboardEntrySchema.omit({
  rank: true,
  friendsRank: true,
});
export type RedisDailyLeaderboardEntry = z.infer<
  typeof RedisDailyLeaderboardEntrySchema
>;

export const RedisXpLeaderboardEntrySchema = z.object({
  uid: z.string(),
  name: z.string(),
  lastActivityTimestamp: z.number().int().nonnegative(),
  timeTypedSeconds: z.number().nonnegative(),
  // optionals
  // discordId: z.string().optional(),
  discordId: z //todo remove once weekly leaderboards reset twice and remove null values
    .string()
    .optional()
    .or(z.null().transform((_val) => undefined)),
  discordAvatar: z.string().optional(),
  badgeId: z.number().int().optional(),
  isPremium: z.boolean().optional(),
});
export type RedisXpLeaderboardEntry = z.infer<
  typeof RedisXpLeaderboardEntrySchema
>;

export const RedisXpLeaderboardScoreSchema = z.number().int().nonnegative();
export type RedisXpLeaderboardScore = z.infer<
  typeof RedisXpLeaderboardScoreSchema
>;

export const XpLeaderboardEntrySchema = RedisXpLeaderboardEntrySchema.extend({
  //based on another redis collection
  totalXp: RedisXpLeaderboardScoreSchema,
  // dynamically added when generating response on the backend
  rank: z.number().nonnegative().int(),
  friendsRank: FriendsRankSchema,
});
export type XpLeaderboardEntry = z.infer<typeof XpLeaderboardEntrySchema>;
