import * as UserDAL from "../../dal/user";
import MonkeyError from "../../utils/error";
import { MonkeyResponse } from "../../utils/monkey-response";
import * as DiscordUtils from "../../utils/discord";
import {
  buildAgentLog,
  omit,
  replaceObjectId,
  replaceObjectIds,
  sanitizeString,
} from "../../utils/misc";
import GeorgeQueue from "../../queues/george-queue";
import { deleteAllApeKeys } from "../../dal/ape-keys";
import { deleteAllPresets } from "../../dal/preset";
import { deleteAll as deleteAllResults } from "../../dal/result";
import { deleteConfig } from "../../dal/config";
import * as LeaderboardsDAL from "../../dal/leaderboards";
import { purgeUserFromDailyLeaderboards } from "../../utils/daily-leaderboards";
import { purgeUserFromXpLeaderboards } from "../../services/weekly-xp-leaderboard";
import { deleteUserAccount } from "../../services/user-deletion";
import { v4 as uuidv4 } from "uuid";
import { ObjectId } from "mongodb";
import * as ReportDAL from "../../dal/report";
import * as AuthUtil from "../../utils/auth";
import * as Dates from "date-fns";
import { UTCDateMini } from "@date-fns/utc";
import * as BlocklistDal from "../../dal/blocklist";
import {
  AllTimeLbs,
  ResultFilters,
  User,
  UserProfile,
  CountByYearAndDay,
  TestActivity,
  UserProfileDetails,
  ProgcompInfo,
} from "@monkeytype/schemas/users";
import { ALL_TIME_LEADERBOARD_LANGUAGES } from "@monkeytype/schemas/leaderboards";
import { addImportantLog, addLog } from "../../dal/logs";
import {
  AddCustomThemeRequest,
  AddCustomThemeResponse,
  AddFavoriteQuoteRequest,
  AddResultFilterPresetRequest,
  AddResultFilterPresetResponse,
  AddTagRequest,
  AddTagResponse,
  CheckNamePathParameters,
  CheckNameResponse,
  CreateUserRequest,
  DeleteCustomThemeRequest,
  EditCustomThemeRequst,
  EditTagRequest,
  ForgotPasswordEmailRequest,
  GetCurrentTestActivityResponse,
  GetCustomThemesResponse,
  GetDiscordOauthLinkResponse,
  GetFavoriteQuotesResponse,
  GetFriendsResponse,
  GetPersonalBestsQuery,
  GetPersonalBestsResponse,
  GetProfilePathParams,
  GetProfileQuery,
  GetProfileResponse,
  GetStatsResponse,
  GetStreakResponse,
  GetTagsResponse,
  GetTestActivityResponse,
  GetUserInboxResponse,
  GetUserResponse,
  LinkDiscordRequest,
  LinkDiscordResponse,
  RemoveFavoriteQuoteRequest,
  RemoveResultFilterPresetPathParams,
  ReportUserRequest,
  SetStreakHourOffsetRequest,
  TagIdPathParams,
  UpdateEmailRequest,
  UpdateLeaderboardMemoryRequest,
  UpdatePasswordRequest,
  UpdateUserInboxRequest,
  UpdateUserNameRequest,
  UpdateUserProfileRequest,
  UpdateUserProfileResponse,
} from "@monkeytype/contracts/users";
import { MILLISECONDS_IN_DAY } from "@monkeytype/util/date-and-time";
import { MonkeyRequest } from "../types";
import { tryCatch } from "@monkeytype/util/trycatch";
import * as ConnectionsDal from "../../dal/connections";
import { PersonalBest } from "@monkeytype/schemas/shared";

export async function createNewUser(
  req: MonkeyRequest<undefined, CreateUserRequest>,
): Promise<MonkeyResponse> {
  const { name } = req.body;
  const { email, uid } = req.ctx.decodedToken;

  if (email.endsWith("@tidal.lol") || email.endsWith("@selfbot.cc")) {
    throw new MonkeyError(400, "Invalid domain");
  }

  const available = await UserDAL.isNameAvailable(name, uid);
  if (!available) {
    throw new MonkeyError(409, "Username unavailable");
  }

  const blocklisted = await BlocklistDal.contains({ name, email });
  if (blocklisted) {
    throw new MonkeyError(409, "Username or email blocked");
  }

  await UserDAL.addUser(name, email, uid);
  void addImportantLog("user_created", `${name} ${email}`, uid);

  return new MonkeyResponse("User created", null);
}

/**
 * Turns a ProgCompJOliva nickname into a valid, unused monkeytype name
 * (slug, max 16 chars). Falls back to a numeric suffix on collisions.
 */
async function getAvailableNameFromNickname(
  nickname: string,
  uid: string,
): Promise<string> {
  const base = nickname.replace(/[^\da-zA-Z_.-]/g, "_").slice(0, 16) || "user";

  for (let i = 0; i < 100; i++) {
    const suffix = i === 0 ? "" : `${i}`;
    const candidate = base.slice(0, 16 - suffix.length) + suffix;
    if (await UserDAL.isNameAvailable(candidate, uid)) return candidate;
  }
  return `user_${uid.slice(0, 11)}`;
}

/**
 * Users live in ProgCompJOlivaApi, so the monkeytype profile is created on the
 * first authenticated request instead of through the signup form.
 */
async function provisionUserFromToken(
  decodedToken: MonkeyRequest["ctx"]["decodedToken"],
): Promise<void> {
  const { uid, email, nickname } = decodedToken;
  if (decodedToken.type !== "Bearer" || nickname === undefined) {
    throw new MonkeyError(404, "User not found", "get user", uid);
  }

  const name = await getAvailableNameFromNickname(nickname, uid);
  await UserDAL.addUser(name, email, uid, getProgcompInfo(decodedToken));
  void addImportantLog(
    "user_created",
    `${name} ${email} (ProgCompJOliva ${nickname})`,
    uid,
  );
}

export async function sendVerificationEmail(
  _req: MonkeyRequest,
): Promise<MonkeyResponse> {
  AuthUtil.throwManagedByProgComp("Email verification");
}

export async function sendForgotPasswordEmail(
  _req: MonkeyRequest<undefined, ForgotPasswordEmailRequest>,
): Promise<MonkeyResponse> {
  AuthUtil.throwManagedByProgComp("Password reset");
}

export async function deleteUser(req: MonkeyRequest): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;

  const userInfo = await deleteUserAccount(uid, req.ctx.configuration);

  void addImportantLog(
    "user_deleted",
    `${userInfo?.email} ${userInfo?.name}`,
    uid,
  );

  return new MonkeyResponse("User deleted", null);
}

export async function resetUser(req: MonkeyRequest): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;

  const userInfo = await UserDAL.getPartialUser(uid, "reset user", [
    "banned",
    "discordId",
    "email",
    "name",
  ]);
  if (userInfo.banned) {
    throw new MonkeyError(403, "Banned users cannot reset their account");
  }

  const promises = [
    UserDAL.resetUser(uid),
    deleteAllApeKeys(uid),
    deleteAllPresets(uid),
    deleteAllResults(uid),
    deleteConfig(uid),
    purgeUserFromDailyLeaderboards(
      uid,
      req.ctx.configuration.dailyLeaderboards,
    ),
    purgeUserFromXpLeaderboards(
      uid,
      req.ctx.configuration.leaderboards.weeklyXp,
    ),
  ];

  if (userInfo.discordId !== undefined && userInfo.discordId !== "") {
    promises.push(GeorgeQueue.unlinkDiscord(userInfo.discordId, uid));
  }
  await Promise.all(promises);
  void addImportantLog("user_reset", `${userInfo.email} ${userInfo.name}`, uid);

  return new MonkeyResponse("User reset", null);
}

export async function updateName(
  req: MonkeyRequest<undefined, UpdateUserNameRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { name } = req.body;

  const blocklisted = await BlocklistDal.contains({ name });
  if (blocklisted) {
    throw new MonkeyError(409, "Username blocked");
  }

  const user = await UserDAL.getPartialUser(uid, "update name", [
    "name",
    "banned",
    "needsToChangeName",
    "lastNameChange",
  ]);

  if (user.banned) {
    throw new MonkeyError(403, "Banned users cannot change their name");
  }

  if (
    !user?.needsToChangeName &&
    Date.now() - (user.lastNameChange ?? 0) < MILLISECONDS_IN_DAY * 30
  ) {
    throw new MonkeyError(409, "You can change your name once every 30 days");
  }

  await UserDAL.updateName(uid, name, user.name);

  await ConnectionsDal.updateName(uid, name);
  void addImportantLog(
    "user_name_updated",
    `changed name from ${user.name} to ${name}`,
    uid,
  );

  return new MonkeyResponse("User's name updated", null);
}

export async function clearPb(req: MonkeyRequest): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;

  await UserDAL.clearPb(uid);
  await purgeUserFromDailyLeaderboards(
    uid,
    req.ctx.configuration.dailyLeaderboards,
  );
  void addImportantLog("user_cleared_pbs", "", uid);

  return new MonkeyResponse("User's PB cleared", null);
}

export async function optOutOfLeaderboards(
  req: MonkeyRequest,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;

  await UserDAL.optOutOfLeaderboards(uid);
  await purgeUserFromDailyLeaderboards(
    uid,
    req.ctx.configuration.dailyLeaderboards,
  );
  await purgeUserFromXpLeaderboards(
    uid,
    req.ctx.configuration.leaderboards.weeklyXp,
  );
  void addImportantLog("user_opted_out_of_leaderboards", "", uid);

  return new MonkeyResponse("User opted out of leaderboards", null);
}

export async function checkName(
  req: MonkeyRequest<undefined, undefined, CheckNamePathParameters>,
): Promise<CheckNameResponse> {
  const { name } = req.params;
  const { uid } = req.ctx.decodedToken;

  const available = await UserDAL.isNameAvailable(name, uid);

  return new MonkeyResponse("Check username", {
    available,
  });
}

export async function updateEmail(
  _req: MonkeyRequest<undefined, UpdateEmailRequest>,
): Promise<MonkeyResponse> {
  AuthUtil.throwManagedByProgComp("Email");
}

export async function updatePassword(
  _req: MonkeyRequest<undefined, UpdatePasswordRequest>,
): Promise<MonkeyResponse> {
  AuthUtil.throwManagedByProgComp("Password");
}

type RelevantUserInfo = Omit<
  UserDAL.DBUser,
  | "bananas"
  | "lbPersonalBests"
  | "inbox"
  | "nameHistory"
  | "lastNameChange"
  | "_id"
  | "lastReultHashes" //TODO fix typo
  | "note"
  | "ips"
  | "testActivity"
  | "suspicious"
>;

function getRelevantUserInfo(user: UserDAL.DBUser): RelevantUserInfo {
  return omit(user, [
    "bananas",
    "lbPersonalBests",
    "inbox",
    "nameHistory",
    "lastNameChange",
    "_id",
    "lastReultHashes", //TODO fix typo
    "note",
    "ips",
    "testActivity",
    "suspicious",
  ]);
}

function getProgcompInfo(
  decodedToken: MonkeyRequest["ctx"]["decodedToken"],
): ProgcompInfo | undefined {
  if (decodedToken.type !== "Bearer" || decodedToken.nickname === undefined) {
    return undefined;
  }
  const info: ProgcompInfo = { nickname: decodedToken.nickname };
  if (decodedToken.org !== undefined && decodedToken.org !== "") {
    info.organization = decodedToken.org;
  }
  return info;
}

async function getOrProvisionUser(
  decodedToken: MonkeyRequest["ctx"]["decodedToken"],
): Promise<UserDAL.DBUser> {
  const { data: userInfo, error } = await tryCatch(
    UserDAL.getUser(decodedToken.uid, "get user"),
  );
  if (error === null) {
    // nickname and organization are managed on ProgCompJOliva, keep them in sync
    const progcomp = getProgcompInfo(decodedToken);
    if (
      progcomp !== undefined &&
      (userInfo.progcomp?.nickname !== progcomp.nickname ||
        userInfo.progcomp?.organization !== progcomp.organization)
    ) {
      await UserDAL.setProgcompInfo(decodedToken.uid, progcomp);
      userInfo.progcomp = progcomp;
    }
    return userInfo;
  }
  if (!(error instanceof MonkeyError) || error.status !== 404) throw error;

  await provisionUserFromToken(decodedToken);
  return UserDAL.getUser(decodedToken.uid, "get user");
}

export async function getUser(req: MonkeyRequest): Promise<GetUserResponse> {
  const { uid } = req.ctx.decodedToken;

  const userInfo = await getOrProvisionUser(req.ctx.decodedToken);

  userInfo.personalBests ??= {
    time: {},
    words: {},
    quote: {},
    zen: {},
    custom: {},
  };

  const agentLog = buildAgentLog(req);
  void addLog("user_data_requested", agentLog, uid);
  void UserDAL.logIpAddress(uid, agentLog.ip, userInfo);

  let inboxUnreadSize = 0;
  if (req.ctx.configuration.users.inbox.enabled) {
    inboxUnreadSize = userInfo.inbox?.filter((mail) => !mail.read).length ?? 0;
  }

  if (!userInfo.name) {
    userInfo.needsToChangeName = true;
    await UserDAL.flagForNameChange(uid);
  }

  const isPremium = await UserDAL.checkIfUserIsPremium(uid, userInfo);

  const allTimeLbs = await getAllTimeLbs(uid);
  const testActivity = generateCurrentTestActivity(userInfo.testActivity);
  const relevantUserInfo = getRelevantUserInfo(userInfo);

  const resultFilterPresets: ResultFilters[] = (
    relevantUserInfo.resultFilterPresets ?? []
  ).map((it) => replaceObjectId(it));
  delete relevantUserInfo.resultFilterPresets;

  const tags = (relevantUserInfo.tags ?? []).map((it) => replaceObjectId(it));
  delete relevantUserInfo.tags;

  const customThemes = (relevantUserInfo.customThemes ?? []).map((it) =>
    replaceObjectId(it),
  );
  delete relevantUserInfo.customThemes;

  const userData: User = {
    ...relevantUserInfo,
    resultFilterPresets,
    tags,
    customThemes,
    isPremium,
    allTimeLbs,
    testActivity,
  };

  return new MonkeyResponse("User data retrieved", {
    ...userData,
    inboxUnreadSize: inboxUnreadSize,
  });
}

export async function getOauthLink(
  req: MonkeyRequest,
): Promise<GetDiscordOauthLinkResponse> {
  const { uid } = req.ctx.decodedToken;

  //build the url
  const url = await DiscordUtils.getOauthLink(uid);

  //return
  return new MonkeyResponse("Discord oauth link generated", {
    url: url,
  });
}

export async function linkDiscord(
  req: MonkeyRequest<undefined, LinkDiscordRequest>,
): Promise<LinkDiscordResponse> {
  const { uid } = req.ctx.decodedToken;
  const { tokenType, accessToken, state } = req.body;

  if (!(await DiscordUtils.iStateValidForUser(state, uid))) {
    throw new MonkeyError(403, "Invalid user token");
  }

  const userInfo = await UserDAL.getPartialUser(uid, "link discord", [
    "banned",
    "discordId",
    "lbOptOut",
  ]);
  if (userInfo.banned) {
    throw new MonkeyError(403, "Banned accounts cannot link with Discord");
  }

  const { id: discordId, avatar: discordAvatar } =
    await DiscordUtils.getDiscordUser(tokenType, accessToken);

  if (userInfo.discordId !== undefined && userInfo.discordId !== "") {
    await UserDAL.linkDiscord(uid, userInfo.discordId, discordAvatar);
    return new MonkeyResponse("Discord avatar updated", {
      discordId,
      discordAvatar,
    });
  }

  if (!discordId) {
    throw new MonkeyError(
      500,
      "Could not get Discord account info",
      "discord id is undefined",
    );
  }

  const discordIdAvailable = await UserDAL.isDiscordIdAvailable(discordId);
  if (!discordIdAvailable) {
    throw new MonkeyError(
      409,
      "This Discord account is linked to a different account",
    );
  }

  if (await BlocklistDal.contains({ discordId })) {
    throw new MonkeyError(409, "The Discord account is blocked");
  }

  await UserDAL.linkDiscord(uid, discordId, discordAvatar);

  await GeorgeQueue.linkDiscord(discordId, uid, userInfo.lbOptOut ?? false);
  void addImportantLog("user_discord_link", `linked to ${discordId}`, uid);

  return new MonkeyResponse("Discord account linked", {
    discordId,
    discordAvatar,
  });
}

export async function unlinkDiscord(
  req: MonkeyRequest,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;

  const userInfo = await UserDAL.getPartialUser(uid, "unlink discord", [
    "banned",
    "discordId",
  ]);

  if (userInfo.banned) {
    throw new MonkeyError(403, "Banned accounts cannot unlink Discord");
  }

  const discordId = userInfo.discordId;
  if (discordId === undefined || discordId === "") {
    throw new MonkeyError(404, "User does not have a linked Discord account");
  }

  await GeorgeQueue.unlinkDiscord(discordId, uid);
  await UserDAL.unlinkDiscord(uid);
  void addImportantLog("user_discord_unlinked", discordId, uid);

  return new MonkeyResponse("Discord account unlinked", null);
}

export async function addResultFilterPreset(
  req: MonkeyRequest<undefined, AddResultFilterPresetRequest>,
): Promise<AddResultFilterPresetResponse> {
  const { uid } = req.ctx.decodedToken;
  const filter = req.body;
  const { maxPresetsPerUser } = req.ctx.configuration.results.filterPresets;

  const createdId = await UserDAL.addResultFilterPreset(
    uid,
    filter,
    maxPresetsPerUser,
  );
  return new MonkeyResponse(
    "Result filter preset created",
    createdId.toHexString(),
  );
}

export async function removeResultFilterPreset(
  req: MonkeyRequest<undefined, undefined, RemoveResultFilterPresetPathParams>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { presetId } = req.params;

  await UserDAL.removeResultFilterPreset(uid, presetId);
  return new MonkeyResponse("Result filter preset deleted", null);
}

export async function addTag(
  req: MonkeyRequest<undefined, AddTagRequest>,
): Promise<AddTagResponse> {
  const { uid } = req.ctx.decodedToken;
  const { tagName } = req.body;

  const tag = await UserDAL.addTag(uid, tagName);
  return new MonkeyResponse("Tag updated", replaceObjectId(tag));
}

export async function clearTagPb(
  req: MonkeyRequest<undefined, undefined, TagIdPathParams>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { tagId } = req.params;

  await UserDAL.removeTagPb(uid, tagId);
  return new MonkeyResponse("Tag PB cleared", null);
}

export async function editTag(
  req: MonkeyRequest<undefined, EditTagRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { tagId, newName } = req.body;

  await UserDAL.editTag(uid, tagId, newName);
  return new MonkeyResponse("Tag updated", null);
}

export async function removeTag(
  req: MonkeyRequest<undefined, undefined, TagIdPathParams>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { tagId } = req.params;

  await UserDAL.removeTag(uid, tagId);
  return new MonkeyResponse("Tag deleted", null);
}

export async function getTags(req: MonkeyRequest): Promise<GetTagsResponse> {
  const { uid } = req.ctx.decodedToken;

  const tags = await UserDAL.getTags(uid);
  return new MonkeyResponse("Tags retrieved", replaceObjectIds(tags));
}

export async function updateLbMemory(
  req: MonkeyRequest<undefined, UpdateLeaderboardMemoryRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { mode, language, rank } = req.body;
  const mode2 = req.body.mode2;

  await UserDAL.updateLbMemory(uid, mode, mode2, language, rank);
  return new MonkeyResponse("Leaderboard memory updated", null);
}

export async function getCustomThemes(
  req: MonkeyRequest,
): Promise<GetCustomThemesResponse> {
  const { uid } = req.ctx.decodedToken;
  const customThemes = await UserDAL.getThemes(uid);
  return new MonkeyResponse(
    "Custom themes retrieved",
    replaceObjectIds(customThemes),
  );
}

export async function addCustomTheme(
  req: MonkeyRequest<undefined, AddCustomThemeRequest>,
): Promise<AddCustomThemeResponse> {
  const { uid } = req.ctx.decodedToken;
  const { name, colors } = req.body;

  const addedTheme = await UserDAL.addTheme(uid, { name, colors });
  return new MonkeyResponse("Custom theme added", replaceObjectId(addedTheme));
}

export async function removeCustomTheme(
  req: MonkeyRequest<undefined, DeleteCustomThemeRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { themeId } = req.body;
  await UserDAL.removeTheme(uid, themeId);
  return new MonkeyResponse("Custom theme removed", null);
}

export async function editCustomTheme(
  req: MonkeyRequest<undefined, EditCustomThemeRequst>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { themeId, theme } = req.body;

  await UserDAL.editTheme(uid, themeId, theme);
  return new MonkeyResponse("Custom theme updated", null);
}

export async function getPersonalBests(
  req: MonkeyRequest<GetPersonalBestsQuery>,
): Promise<GetPersonalBestsResponse> {
  const { uid } = req.ctx.decodedToken;
  const { mode, mode2 } = req.query;

  const data = (await UserDAL.getPersonalBests(uid, mode, mode2)) ?? null;
  return new MonkeyResponse("Personal bests retrieved", data);
}

export async function getStats(req: MonkeyRequest): Promise<GetStatsResponse> {
  const { uid } = req.ctx.decodedToken;

  const data = (await UserDAL.getStats(uid)) ?? null;
  return new MonkeyResponse("Personal stats retrieved", data);
}

export async function getFavoriteQuotes(
  req: MonkeyRequest,
): Promise<GetFavoriteQuotesResponse> {
  const { uid } = req.ctx.decodedToken;

  const quotes = await UserDAL.getFavoriteQuotes(uid);

  return new MonkeyResponse("Favorite quotes retrieved", quotes);
}

export async function addFavoriteQuote(
  req: MonkeyRequest<undefined, AddFavoriteQuoteRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;

  const { language, quoteId } = req.body;

  await UserDAL.addFavoriteQuote(
    uid,
    language,
    quoteId,
    req.ctx.configuration.quotes.maxFavorites,
  );

  return new MonkeyResponse("Quote added to favorites", null);
}

export async function removeFavoriteQuote(
  req: MonkeyRequest<undefined, RemoveFavoriteQuoteRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;

  const { quoteId, language } = req.body;
  await UserDAL.removeFavoriteQuote(uid, language, quoteId);

  return new MonkeyResponse("Quote removed from favorites", null);
}

export async function getProfile(
  req: MonkeyRequest<GetProfileQuery, undefined, GetProfilePathParams>,
): Promise<GetProfileResponse> {
  const { uidOrName } = req.params;

  const user = req.query.isUid
    ? await UserDAL.getUser(uidOrName, "get user profile")
    : await UserDAL.getUserByName(uidOrName, "get user profile");

  const {
    name,
    banned,
    inventory,
    profileDetails,
    personalBests,
    completedTests,
    startedTests,
    timeTyping,
    addedAt,
    discordId,
    discordAvatar,
    xp,
    streak,
    lbOptOut,
    progcomp,
  } = user;

  const extractValid = (
    src: Record<string, PersonalBest[]>,
    validKeys: string[],
  ): Record<string, PersonalBest[]> => {
    return validKeys.reduce((obj, key) => {
      if (src?.[key] !== undefined) {
        obj[key] = src[key];
      }
      return obj;
    }, {});
  };

  const validTimePbs = extractValid(personalBests.time, [
    "15",
    "30",
    "60",
    "120",
  ]);
  const validWordsPbs = extractValid(personalBests.words, [
    "10",
    "25",
    "50",
    "100",
  ]);

  const typingStats = {
    completedTests,
    startedTests,
    timeTyping,
  };

  const relevantPersonalBests = {
    time: validTimePbs,
    words: validWordsPbs,
  };

  const baseProfile = {
    name,
    banned,
    addedAt,
    typingStats,
    personalBests: relevantPersonalBests,
    discordId,
    discordAvatar,
    xp,
    streak: streak?.length ?? 0,
    maxStreak: streak?.maxLength ?? 0,
    lbOptOut,
    isPremium: await UserDAL.checkIfUserIsPremium(user.uid, user),
    progcomp,
  };

  if (banned) {
    return new MonkeyResponse("Profile retrived: banned user", baseProfile);
  }

  const allTimeLbs = await getAllTimeLbs(user.uid);

  const profileData = {
    ...baseProfile,
    inventory,
    details: profileDetails,
    allTimeLbs,
    uid: user.uid,
  } as UserProfile;

  if (user.profileDetails?.showActivityOnPublicProfile) {
    profileData.testActivity = generateCurrentTestActivity(user.testActivity);
  } else {
    delete profileData.testActivity;
  }
  return new MonkeyResponse("Profile retrieved", profileData);
}

export async function updateProfile(
  req: MonkeyRequest<undefined, UpdateUserProfileRequest>,
): Promise<UpdateUserProfileResponse> {
  const { uid } = req.ctx.decodedToken;
  const {
    bio,
    keyboard,
    socialProfiles,
    selectedBadgeId,
    showActivityOnPublicProfile,
  } = req.body;

  const user = await UserDAL.getPartialUser(uid, "update user profile", [
    "banned",
    "inventory",
  ]);

  if (user.banned) {
    throw new MonkeyError(403, "Banned users cannot update their profile");
  }

  user.inventory?.badges.forEach((badge) => {
    if (badge.id === selectedBadgeId) {
      badge.selected = true;
    } else {
      delete badge.selected;
    }
  });

  const profileDetailsUpdates: Partial<UserProfileDetails> = {
    bio: sanitizeString(bio),
    keyboard: sanitizeString(keyboard),
    socialProfiles: Object.fromEntries(
      Object.entries(socialProfiles ?? {}).map(([key, value]) => [
        key,
        sanitizeString(value),
      ]),
    ),
    showActivityOnPublicProfile,
  };

  await UserDAL.updateProfile(uid, profileDetailsUpdates, user.inventory);

  return new MonkeyResponse("Profile updated", profileDetailsUpdates);
}

export async function getInbox(
  req: MonkeyRequest,
): Promise<GetUserInboxResponse> {
  const { uid } = req.ctx.decodedToken;

  const inbox = await UserDAL.getInbox(uid);

  return new MonkeyResponse("Inbox retrieved", {
    inbox,
    maxMail: req.ctx.configuration.users.inbox.maxMail,
  });
}

export async function updateInbox(
  req: MonkeyRequest<undefined, UpdateUserInboxRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { mailIdsToMarkRead, mailIdsToDelete } = req.body;

  await UserDAL.updateInbox(
    uid,
    mailIdsToMarkRead ?? [],
    mailIdsToDelete ?? [],
  );

  return new MonkeyResponse("Inbox updated", null);
}

export async function reportUser(
  req: MonkeyRequest<undefined, ReportUserRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const {
    reporting: { maxReports, contentReportLimit },
  } = req.ctx.configuration.quotes;

  const { uid: uidToReport, reason, comment } = req.body;

  const newReport: ReportDAL.DBReport = {
    _id: new ObjectId(),
    id: uuidv4(),
    type: "user",
    timestamp: new Date().getTime(),
    uid,
    contentId: `${uidToReport}`,
    reason,
    comment: comment ?? "",
  };

  await ReportDAL.createReport(newReport, maxReports, contentReportLimit);

  return new MonkeyResponse("User reported", null);
}

export async function setStreakHourOffset(
  req: MonkeyRequest<undefined, SetStreakHourOffsetRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { hourOffset } = req.body;

  const user = await UserDAL.getPartialUser(uid, "update user profile", [
    "streak",
  ]);

  if (
    user.streak?.hourOffset !== undefined &&
    user.streak?.hourOffset !== null
  ) {
    throw new MonkeyError(403, "Streak hour offset already set");
  }

  await UserDAL.setStreakHourOffset(uid, hourOffset);

  void addImportantLog("user_streak_hour_offset_set", { hourOffset }, uid);

  return new MonkeyResponse("Streak hour offset set", null);
}

export async function revokeAllTokens(
  req: MonkeyRequest,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  await AuthUtil.revokeTokensByUid(uid);
  void addImportantLog("user_tokens_revoked", "", uid);
  return new MonkeyResponse("All tokens revoked", null);
}

async function getAllTimeLbs(uid: string): Promise<AllTimeLbs> {
  const allTimeLbs: AllTimeLbs = { time: { "15": {}, "60": {} } };

  for (const language of ALL_TIME_LEADERBOARD_LANGUAGES) {
    for (const mode2 of ["15", "60"] as const) {
      const rank = await LeaderboardsDAL.getRank("time", mode2, language, uid);
      if (rank === false || rank === null) continue;

      const count = await LeaderboardsDAL.getCount("time", mode2, language);
      // oxlint-disable-next-line typescript/no-non-null-assertion
      allTimeLbs.time[mode2]![language] = { rank: rank.rank, count };
    }
  }

  return allTimeLbs;
}

export function generateCurrentTestActivity(
  testActivity: CountByYearAndDay | undefined,
): TestActivity | undefined {
  const thisYear = Dates.startOfYear(new UTCDateMini());
  const lastYear = Dates.startOfYear(Dates.subYears(thisYear, 1));

  let thisYearData = testActivity?.[thisYear.getFullYear().toString()];
  let lastYearData = testActivity?.[lastYear.getFullYear().toString()];

  if (lastYearData === undefined && thisYearData === undefined) {
    return undefined;
  }

  lastYearData = lastYearData ?? [];
  thisYearData = thisYearData ?? [];

  //make sure lastYearData covers the full year
  if (lastYearData.length < Dates.getDaysInYear(lastYear)) {
    lastYearData.push(
      ...(new Array(Dates.getDaysInYear(lastYear) - lastYearData.length).fill(
        undefined,
      ) as (number | null)[]),
    );
  }
  //use enough days of the last year to have 372 days in total to always fill the first week of the graph
  lastYearData = lastYearData.slice(-372 + thisYearData.length);

  const lastDay = Dates.startOfDay(
    Dates.addDays(thisYear, thisYearData.length - 1),
  );

  return {
    testsByDays: [...lastYearData, ...thisYearData],
    lastDay: lastDay.valueOf(),
  };
}

export async function getTestActivity(
  req: MonkeyRequest,
): Promise<GetTestActivityResponse> {
  const { uid } = req.ctx.decodedToken;
  const premiumFeaturesEnabled = req.ctx.configuration.users.premium.enabled;
  const user = await UserDAL.getPartialUser(uid, "testActivity", [
    "testActivity",
    "premium",
  ]);
  const userHasPremium = await UserDAL.checkIfUserIsPremium(uid, user);

  if (!premiumFeaturesEnabled) {
    throw new MonkeyError(503, "Premium features are disabled");
  }

  if (!userHasPremium) {
    throw new MonkeyError(503, "User does not have premium");
  }

  return new MonkeyResponse(
    "Test activity data retrieved",
    user.testActivity ?? null,
  );
}

export async function getCurrentTestActivity(
  req: MonkeyRequest,
): Promise<GetCurrentTestActivityResponse> {
  const { uid } = req.ctx.decodedToken;

  const user = await UserDAL.getPartialUser(uid, "current test activity", [
    "testActivity",
  ]);
  const data = generateCurrentTestActivity(user.testActivity);
  return new MonkeyResponse(
    "Current test activity data retrieved",
    data ?? null,
  );
}

export async function getStreak(
  req: MonkeyRequest,
): Promise<GetStreakResponse> {
  const { uid } = req.ctx.decodedToken;

  const user = await UserDAL.getPartialUser(uid, "streak", ["streak"]);

  return new MonkeyResponse("Streak data retrieved", user.streak ?? null);
}

export async function getFriends(
  req: MonkeyRequest,
): Promise<GetFriendsResponse> {
  const { uid } = req.ctx.decodedToken;
  const premiumEnabled = req.ctx.configuration.users.premium.enabled;
  const data = await UserDAL.getFriends(uid);

  if (!premiumEnabled) {
    for (const friend of data) {
      delete friend.isPremium;
    }
  }

  return new MonkeyResponse("Friends retrieved", data);
}
