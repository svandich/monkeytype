import { queryClient } from ".";
import {
  getContributorsQueryOptions,
  getSpeedHistogramQueryOptions,
  getSupportersQueryOptions,
  getTypingStatsQueryOptions,
} from "./public";
import { getLeaderboardQueryOptions } from "./leaderboards";
import { QUOTE_LEADERBOARD_LANGUAGES } from "@monkeytype/schemas/leaderboards";

export function prefetchAboutPage(): void {
  void queryClient.prefetchQuery(getContributorsQueryOptions());
  void queryClient.prefetchQuery(getSupportersQueryOptions());
  void queryClient.prefetchQuery(getTypingStatsQueryOptions());
  void queryClient.prefetchQuery(getSpeedHistogramQueryOptions());
}

export function prefetchLeaderboardPage(): void {
  void queryClient.prefetchQuery(
    getLeaderboardQueryOptions({
      type: "quotes",
      mode: "quote",
      mode2: "all",
      language: QUOTE_LEADERBOARD_LANGUAGES[0],
      friendsOnly: false,
      page: 0,
      previous: false,
    }),
  );
}
