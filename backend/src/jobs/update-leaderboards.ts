import { CronJob } from "cron";
import GeorgeQueue from "../queues/george-queue";
import * as LeaderboardsDAL from "../dal/leaderboards";
import { getCachedConfiguration } from "../init/configuration";
import { ALL_TIME_LEADERBOARD_LANGUAGES } from "@monkeytype/schemas/leaderboards";
import { Language } from "@monkeytype/schemas/languages";

const CRON_SCHEDULE = "30 * * * * *";
const RECENT_AGE_MINUTES = 10;
const RECENT_AGE_MILLISECONDS = RECENT_AGE_MINUTES * 60 * 1000;

async function getTop10(
  leaderboardTime: string,
  language: Language,
): Promise<LeaderboardsDAL.DBLeaderboardEntry[]> {
  return (await LeaderboardsDAL.get(
    "time",
    leaderboardTime,
    language,
    0,
    10,
  )) as LeaderboardsDAL.DBLeaderboardEntry[]; //can do that because gettop10 will not be called during an update
}

async function updateLeaderboardAndNotifyChanges(
  leaderboardTime: string,
  language: Language,
): Promise<void> {
  const top10BeforeUpdate = await getTop10(leaderboardTime, language);

  const previousRecordsMap = Object.fromEntries(
    top10BeforeUpdate.map((record) => {
      return [record.uid, record];
    }),
  );

  await LeaderboardsDAL.update("time", leaderboardTime, language);

  const top10AfterUpdate = await getTop10(leaderboardTime, language);

  const newRecords = top10AfterUpdate.filter((record) => {
    const userId = record.uid;

    const previousMapUser = previousRecordsMap[userId];
    const userImprovedRank =
      previousMapUser && previousMapUser.rank > record.rank;

    const newUserInTop10 = !(userId in previousRecordsMap);

    const isRecentRecord =
      record.timestamp > Date.now() - RECENT_AGE_MILLISECONDS;

    return (userImprovedRank === true || newUserInTop10) && isRecentRecord;
  });

  if (newRecords.length > 0) {
    const leaderboardId = `time ${leaderboardTime} ${language}`;

    await GeorgeQueue.announceLeaderboardUpdate(newRecords, leaderboardId);
  }
}

let isUpdating = false;

async function updateLeaderboards(): Promise<void> {
  const { maintenance } = await getCachedConfiguration();
  if (maintenance || isUpdating) {
    return;
  }

  //skip this tick if the previous run is still going
  isUpdating = true;
  try {
    for (const language of ALL_TIME_LEADERBOARD_LANGUAGES) {
      await updateLeaderboardAndNotifyChanges("60", language);
      await updateLeaderboardAndNotifyChanges("15", language);
    }
  } finally {
    isUpdating = false;
  }
}

export default new CronJob(CRON_SCHEDULE, updateLeaderboards);
