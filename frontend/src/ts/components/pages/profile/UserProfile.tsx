import { Language } from "@monkeytype/schemas/languages";
import { QUOTE_LEADERBOARD_LANGUAGES } from "@monkeytype/schemas/leaderboards";
import {
  LanguageQuoteStats,
  QuoteBest,
  QuoteLengthNameSchema,
  RankAndCount,
  UserProfile as UserProfileType,
} from "@monkeytype/schemas/users";
import { useQuery } from "@tanstack/solid-query";
import { formatDate } from "date-fns/format";
import { For, JSXElement, Show } from "solid-js";

import { getLeaderboardQuotesQueryOptions } from "../../../queries/leaderboards";
import { getFormatting } from "../../../states/core";
import { formatTopPercentage } from "../../../utils/misc";
import { capitalizeFirstLetter } from "../../../utils/strings";
import { ActivityCalendar } from "./ActivityCalendar";
import { UserDetails } from "./UserDetails";

export function UserProfile(props: {
  profile: UserProfileType;
  isAccountPage?: true;
}): JSXElement {
  return (
    <div class="grid w-full gap-8">
      <UserDetails
        profile={props.profile}
        isAccountPage={props.isAccountPage}
      />
      <Show when={!props.profile.banned && !props.profile.lbOptOut}>
        <For each={QUOTE_LEADERBOARD_LANGUAGES}>
          {(language) => (
            <LeaderboardPosition
              language={language}
              rank={props.profile.quoteStats?.[language]?.rank}
            />
          )}
        </For>
      </Show>
      <For each={QUOTE_LEADERBOARD_LANGUAGES}>
        {(language) => (
          <QuoteBestsCard
            language={language}
            stats={props.profile.quoteStats?.[language]}
          />
        )}
      </For>
      <Show when={props.profile.lbOptOut}>
        <span class="text-center text-xs text-sub">
          Note: This account has opted out of the leaderboards, meaning their
          results aren&apos;t verified by the anticheat system and may not be
          legitimate.
        </span>
      </Show>

      <ActivityCalendar
        testActivity={
          props.isAccountPage ? undefined : props.profile.testActivity
        }
        isAccountPage={props.isAccountPage}
      />
    </div>
  );
}

function LeaderboardPosition(props: {
  language: Language;
  rank?: RankAndCount;
}): JSXElement {
  const format = getFormatting;

  return (
    <Show when={props.rank?.rank !== undefined}>
      <div class="grid w-full grid-cols-1 items-center gap-4 rounded bg-sub-alt p-4 text-sub md:grid-cols-2">
        <span class="text-center">
          {capitalizeFirstLetter(props.language)} Quote Leaderboard
        </span>
        <div class="grid grid-cols-2 gap-x-4">
          <div class="justify-self-end">all quotes</div>
          <div class="row-span-2 text-3xl text-text">
            {format().rank(props.rank?.rank)}
          </div>
          <div class="justify-self-end text-xs">
            {formatTopPercentage(props.rank)}
          </div>
        </div>
      </div>
    </Show>
  );
}

type QuoteBestItem = {
  label: string;
  best?: QuoteBest;
  /** what the best is made of, shown on hover */
  detail?: string;
};

function QuoteBestsCard(props: {
  language: Language;
  stats?: LanguageQuoteStats;
}): JSXElement {
  const format = getFormatting;

  const quotesQuery = useQuery(() => ({
    ...getLeaderboardQuotesQueryOptions(props.language),
    enabled: props.stats !== undefined,
  }));

  const items = (): QuoteBestItem[] => [
    ...QuoteLengthNameSchema.options.map((length) => {
      const best = props.stats?.lengths[length];
      const source = quotesQuery.data?.find(
        (it) => it.id === best?.quoteId,
      )?.source;
      return {
        label: length,
        best,
        detail:
          best !== undefined
            ? `#${best.quoteId}${source !== undefined ? ` ${source}` : ""}`
            : undefined,
      };
    }),
    {
      label: "all",
      best: props.stats?.overall,
      detail:
        props.stats !== undefined
          ? `average of ${props.stats.overall.quotes} quotes`
          : undefined,
    },
  ];

  return (
    <div class="grid gap-4 rounded bg-sub-alt p-4">
      <div class="text-center text-sub">
        {capitalizeFirstLetter(props.language)} Quotes
      </div>
      <div class="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-5">
        <For each={items()}>
          {(item) => (
            <div class="group grid items-center">
              <div
                class={
                  item.best !== undefined
                    ? "col-start-1 row-start-1 text-center transition-opacity group-hover:opacity-0"
                    : "col-start-1 row-start-1 text-center"
                }
              >
                <div class="text-xs text-sub">{item.label}</div>
                <div class="text-4xl">
                  {format().typingSpeed(item.best?.wpm, {
                    showDecimalPlaces: false,
                  })}
                </div>
                <div class="text-xl opacity-75">
                  {format().accuracy(item.best?.acc, {
                    showDecimalPlaces: false,
                  })}
                </div>
              </div>

              <Show when={item.best !== undefined}>
                <div class="col-start-1 row-start-1 grid bg-sub-alt text-center text-xs opacity-0 transition-opacity group-hover:opacity-100">
                  <div class="truncate text-sub">{item.detail}</div>
                  <div>
                    {format().typingSpeed(item.best?.wpm)}{" "}
                    {format().typingSpeedUnit}
                  </div>
                  <div>{format().typingSpeed(item.best?.raw)} raw</div>
                  <div>{format().accuracy(item.best?.acc)} acc</div>
                  <div>{format().percentage(item.best?.consistency)} con</div>
                  <div class="text-sub">
                    {formatDate(item.best?.timestamp ?? 0, "dd MMM yyyy")}
                  </div>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
