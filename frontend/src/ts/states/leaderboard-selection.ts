import { LanguageSchema } from "@monkeytype/schemas/languages";
import {
  ALL_TIME_LEADERBOARD_LANGUAGES,
  QUOTE_LEADERBOARD_LANGUAGES,
} from "@monkeytype/schemas/leaderboards";
import { ModeSchema } from "@monkeytype/schemas/shared";
import { Accessor, createEffect, createSignal, Setter } from "solid-js";
import { z } from "zod";
import { serialize as serializeUrlSearchParams } from "zod-urlsearchparams";
import { useLocalStorage } from "../hooks/useLocalStorage";

import { get as getServerConfiguration } from "../ape/server-configuration";
import { getSnapshot } from "./snapshot";

export const pageSize = 50;

export type LeaderboardType = Selection["type"];
const XpSelection = z.object({
  type: z.literal("weekly"),
  friendsOnly: z.boolean(),
  previous: z.boolean(),
  language: z.never().optional(),
  mode: z.never().optional(),
  mode2: z.never().optional(),
  organization: z.never().optional(),
});
const SpeedSelection = z.object({
  type: z.enum(["daily", "allTime", "universities", "quotes"]),
  friendsOnly: z.boolean(),
  previous: z.boolean(),
  mode: ModeSchema,
  /** on quote leaderboards the quote id, or "all" for the overall one */
  mode2: z.string(),
  language: LanguageSchema,
  /** organization (university) short name, all-time and quote leaderboards only */
  organization: z.string().optional(),
});

export const SelectionSchema = SpeedSelection.or(XpSelection);
export type Selection = z.infer<typeof SelectionSchema>;

export const LeaderboardUrlParamsSchema = z
  .object({
    type: z.enum(["allTime", "daily", "weekly", "universities", "quotes"]),
    mode: ModeSchema.optional(),
    mode2: z.string().optional(),
    language: LanguageSchema.optional(),
    yesterday: z.boolean().optional(),
    lastWeek: z.boolean().optional(),
    friendsOnly: z.boolean().optional(),
    organization: z.string().optional(),
    page: z.number().optional(),
    goToUserPage: z.boolean().optional(),
  })
  .partial();
export type LeaderboardUrlParams = z.infer<typeof LeaderboardUrlParamsSchema>;

const [getSelectionLs, setSelection] = lsSelection();
export const [getPage, setPage] = createSignal(0);
export const [getGoToUserPage, setGoToUserPage] = createSignal(false);

// Reset friendsOnly when connections are disabled
createEffect(() => {
  if (
    getSelectionLs().friendsOnly &&
    (getSnapshot() === undefined ||
      getServerConfiguration()?.connections.enabled === false)
  ) {
    setSelection((old) => ({ ...old, friendsOnly: false }));
  }
});

export const getSelection = (): Selection => {
  return getSelectionLs();
};

export { setSelection };

export function readLeaderboardGetParameters(
  params: LeaderboardUrlParams | undefined,
): void {
  if (params?.type === undefined) return;

  let newSelection: Partial<Selection> = {
    type: params.type,
    friendsOnly: params.friendsOnly ?? false,
  };

  if (params.type === "weekly") {
    newSelection.previous = params.lastWeek ?? false;
  } else if (params.type === "quotes") {
    newSelection.mode = "quote";
    newSelection.mode2 = params.mode2 ?? "all";
    newSelection.language = params.language ?? QUOTE_LEADERBOARD_LANGUAGES[0];
    newSelection.previous = false;
    newSelection.organization = params.organization;
  } else {
    newSelection.mode = params.mode ?? "time";
    newSelection.mode2 = params.mode2 ?? "15";
    newSelection.language =
      params.language ?? ALL_TIME_LEADERBOARD_LANGUAGES[0];
    newSelection.previous =
      params.type === "daily" && (params.yesterday ?? false);
    newSelection.organization =
      params.type === "allTime" ? params.organization : undefined;
  }

  //weekly selections must not carry over mode, mode2, language or organization
  const { mode, mode2, language, organization, ...base } = getSelection();
  const current =
    params.type === "weekly"
      ? base
      : { ...base, mode, mode2, language, organization };

  setSelection({ ...current, ...newSelection } as Selection);

  if (params.goToUserPage === true) {
    setGoToUserPage(true);
  } else if (params.page !== undefined) {
    setPage(Math.max(0, params.page - 1));
  }
}

export function updateGetParameters(
  selection: Selection,
  pageNumber: number,
): void {
  const params: LeaderboardUrlParams = {
    type: selection.type,
    mode: selection.mode,
    mode2: selection.mode2,
    language: selection.language,
    page: pageNumber + 1,
  };

  if (selection.type === "weekly" && selection.previous) {
    params.lastWeek = true;
  }
  if (selection.type === "daily" && selection.previous) {
    params.yesterday = true;
  }
  if (selection.friendsOnly) {
    params.friendsOnly = true;
  }
  if (selection.organization !== undefined) {
    params.organization = selection.organization;
  }

  const urlParams = serializeUrlSearchParams({
    schema: LeaderboardUrlParamsSchema,
    data: params,
  });
  const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
  window.history.replaceState({}, "", newUrl);
}

function lsSelection(): [Accessor<Selection>, Setter<Selection>] {
  return useLocalStorage<Selection>({
    key: "leaderboardSelector",
    schema: SelectionSchema,
    fallback: {
      type: "allTime",
      mode: "time",
      mode2: "15",
      language: ALL_TIME_LEADERBOARD_LANGUAGES[0],
      friendsOnly: false,
      previous: false,
    },
    migrate: (value) => {
      if (value === null || typeof value !== "object") {
        return {} as Selection;
      }
      const result = value as Selection;
      if ("lastWeek" in result) {
        delete result["lastWeek"];
        result.previous = true;
      } else if ("yesterday" in result) {
        delete result["yesterday"];
        result.previous = true;
      }

      if (result.type === "weekly") {
        delete result.mode;
        delete result.mode2;
        delete result.language;
        delete result.organization;
      }
      return result;
    },
  });
}
