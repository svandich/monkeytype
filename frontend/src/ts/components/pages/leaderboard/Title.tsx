import { UTCDateMini } from "@date-fns/utc/date/mini";
import {
  ORGANIZATION_TEAM_SIZE,
  QUOTE_LEADERBOARD_MIN_QUOTES,
} from "@monkeytype/schemas/leaderboards";
import { QuoteData } from "@monkeytype/schemas/quotes";
import {
  endOfDay,
  endOfWeek,
  startOfDay,
  startOfWeek,
  subDays,
  subHours,
  subMinutes,
} from "date-fns";
import { format as dateFormat } from "date-fns/format";
import { createMemo, JSXElement, Show } from "solid-js";

import { Selection } from "../../../states/leaderboard-selection";
import { capitalizeFirstLetter } from "../../../utils/strings";
import { Button } from "../../common/Button";
import { H2 } from "../../common/Headers";

export function Title(props: {
  selection: Selection;
  onPreviousSelect: () => void;
  /** the selected quote, on single quote and university leaderboards */
  quote?: QuoteData["quotes"][number];
}): JSXElement {
  const title = createMemo(() => {
    const type = {
      allTime: "Words",
      universities: "University",
      quotes: "Quote",
      weekly: "Weekly XP",
      daily: "Daily",
    }[props.selection.type];

    const friend = props.selection.friendsOnly ? "Friends " : "";
    const organization =
      props.selection.organization !== undefined
        ? `${props.selection.organization} `
        : "";

    const language = capitalizeFirstLetter(props.selection.language ?? "");

    let mode =
      props.selection.type !== "weekly"
        ? ` ${capitalizeFirstLetter(props.selection.mode ?? "")} ${props.selection.mode2}`
        : "";
    if (
      props.selection.type === "quotes" ||
      props.selection.type === "universities"
    ) {
      mode =
        props.selection.mode2 === "all"
          ? " Overall"
          : ` #${props.selection.mode2} ${props.quote?.source ?? ""}`;
    }
    return `${type} ${language} ${mode} ${organization}${friend}Leaderboard`;
  });

  const subTitle = createMemo(() => {
    const utcDateFormat = "EEEE, do MMMM yyyy";
    const localDateFormat = "EEEE, do MMMM yyyy HH:mm";
    const toLocalString = (
      timestamp: UTCDateMini,
      endTimestamp: UTCDateMini,
    ): string =>
      `local time\n${dateFormat(utcToLocalDate(timestamp), localDateFormat)} -\n${dateFormat(utcToLocalDate(endTimestamp), localDateFormat)}`;

    if (props.selection.type === "daily") {
      let timestamp = startOfDay(new UTCDateMini());
      if (props.selection.previous) {
        timestamp = subHours(timestamp, 24);
      }
      const endTimestamp = endOfDay(timestamp);
      return {
        dateString: `${dateFormat(timestamp, utcDateFormat)} UTC`,
        localString: toLocalString(timestamp, endTimestamp),
        buttonText: props.selection.previous ? "show today" : "show yesterday",
      };
    } else if (props.selection.type === "weekly") {
      let timestamp = startOfWeek(new UTCDateMini(), { weekStartsOn: 1 });
      if (props.selection.previous) {
        timestamp = subDays(timestamp, 7);
      }
      const endTimestamp = endOfWeek(timestamp, { weekStartsOn: 1 });

      return {
        dateString: `${dateFormat(timestamp, utcDateFormat)} - ${dateFormat(endTimestamp, utcDateFormat)} UTC`,
        localString: toLocalString(timestamp, endTimestamp),
        buttonText: props.selection.previous
          ? "show this week"
          : "show last week",
      };
    }
    return null;
  });

  return (
    <div>
      <H2
        text={title()}
        class="p-0 text-2xl text-text md:text-3xl xl:text-4xl"
      />
      <Show when={subTitle() !== null}>
        <div class="flex items-center gap-2">
          <div
            class="text-sub"
            data-balloon-pos="down"
            data-balloon-break
            aria-label={subTitle()?.localString}
          >
            {subTitle()?.dateString}
          </div>
          <div class="h-[1.75em] w-[0.25em] rounded bg-sub-alt"></div>
          <Button
            text={subTitle()?.buttonText}
            variant="text"
            onClick={props.onPreviousSelect}
            fa={{
              icon: props.selection.previous ? "fa-forward" : "fa-backward",
              variant: "solid",
            }}
          />
        </div>
      </Show>
      <Show
        when={
          props.selection.type === "quotes" ||
          props.selection.type === "universities"
        }
      >
        <Show when={props.selection.type === "universities"}>
          <div class="text-sub">
            Average speed of each university&apos;s {ORGANIZATION_TEAM_SIZE}{" "}
            fastest typists on the {props.quote ? "quote" : "overall quote"}{" "}
            leaderboard, missing ones count as 0.
          </div>
        </Show>
        <Show
          when={props.quote}
          fallback={
            <Show when={props.selection.type === "quotes"}>
              <div class="text-sub">
                Average of the best result on each quote typed, at least{" "}
                {QUOTE_LEADERBOARD_MIN_QUOTES} different quotes required.
              </div>
            </Show>
          }
        >
          {(quote) => (
            <pre class="mt-2 max-h-48 overflow-auto rounded bg-sub-alt p-4 text-sm [tab-size:4] text-sub">
              {quote().text}
            </pre>
          )}
        </Show>
      </Show>
    </div>
  );
}

function utcToLocalDate(timestamp: UTCDateMini): Date {
  return subMinutes(timestamp, new Date().getTimezoneOffset());
}
