import { PersonalBest } from "@monkeytype/schemas/shared";
import * as UserDAL from "../dal/user";
import Logger from "../utils/logger";

/**
 * Pushes a user's typing summary and leaderboard-eligible personal bests to
 * ProgCompJOlivaApi (`PUT /api/typing/users/{id}`), so the main site can show
 * them. Enabled when both PROGCOMP_API_URL and PROGCOMP_TYPING_TOKEN are set.
 */

const PUSH_DELAY_MS = 5 * 1000;
const PUSH_TIMEOUT_MS = 10 * 1000;

const pending = new Map<string, NodeJS.Timeout>();

type TypingPersonalBest = {
  mode: "time" | "words";
  mode2: string;
  language: string;
  wpm: number;
  acc: number;
  raw: number;
  consistency?: number;
  timestamp: number;
};

function getConfig(): { url: string; token: string } | undefined {
  const url = process.env["PROGCOMP_API_URL"];
  const token = process.env["PROGCOMP_TYPING_TOKEN"];
  if (url === undefined || url === "" || token === undefined || token === "") {
    return undefined;
  }
  return { url: url.replace(/\/+$/, ""), token };
}

/**
 * Monkeytype uids are ProgCompJOliva GUIDs without hyphens, see
 * `toMonkeytypeUid` in utils/auth.ts.
 */
export function toProgcompUserId(uid: string): string | undefined {
  const match =
    /^([\da-f]{8})([\da-f]{4})([\da-f]{4})([\da-f]{4})([\da-f]{12})$/.exec(uid);
  return match === null ? undefined : match.slice(1).join("-");
}

/** same criteria as the all-time leaderboards */
function isLeaderboardEligible(pb: PersonalBest): boolean {
  return (
    pb.difficulty === "normal" &&
    pb.punctuation !== true &&
    pb.numbers !== true &&
    pb.lazyMode !== true
  );
}

export function getTypingPersonalBests(
  personalBests: UserDAL.DBUser["personalBests"] | undefined,
): TypingPersonalBest[] {
  const result: TypingPersonalBest[] = [];

  for (const mode of ["time", "words"] as const) {
    for (const [mode2, pbs] of Object.entries(personalBests?.[mode] ?? {})) {
      const bestByLanguage = new Map<string, PersonalBest>();
      for (const pb of pbs.filter(isLeaderboardEligible)) {
        const best = bestByLanguage.get(pb.language);
        if (best === undefined || pb.wpm > best.wpm) {
          bestByLanguage.set(pb.language, pb);
        }
      }

      for (const pb of bestByLanguage.values()) {
        result.push({
          mode,
          mode2,
          language: pb.language,
          wpm: pb.wpm,
          acc: pb.acc,
          raw: pb.raw,
          consistency: pb.consistency,
          timestamp: pb.timestamp,
        });
      }
    }
  }

  return result;
}

async function push(uid: string): Promise<void> {
  const config = getConfig();
  const userId = toProgcompUserId(uid);
  if (config === undefined || userId === undefined) return;

  const user = await UserDAL.getUser(uid, "progcomp sync");
  if (user.banned === true) return;

  const response = await fetch(`${config.url}/api/typing/users/${userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Typing-Token": config.token,
    },
    body: JSON.stringify({
      name: user.name,
      testsStarted: user.startedTests ?? 0,
      testsCompleted: user.completedTests ?? 0,
      timeTypingSeconds: user.timeTyping ?? 0,
      personalBests: getTypingPersonalBests(user.personalBests),
    }),
    signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
}

/**
 * Schedules a push of the user's stats. Calls within PUSH_DELAY_MS are merged,
 * which also lets the fire-and-forget stat updates of a result settle first.
 */
export function schedulePush(uid: string): void {
  if (getConfig() === undefined) return;

  clearTimeout(pending.get(uid));
  pending.set(
    uid,
    setTimeout(() => {
      pending.delete(uid);
      push(uid).catch((e: unknown) => {
        Logger.warning(
          `Could not push typing stats of ${uid} to ProgCompJOliva: ${(e as Error).message}`,
        );
      });
    }, PUSH_DELAY_MS),
  );
}
