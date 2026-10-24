import { ValidModeRule } from "@monkeytype/schemas/configuration";
import { Language } from "@monkeytype/schemas/languages";
import {
  ALL_TIME_LEADERBOARD_LANGUAGES,
  isQuoteLeaderboardLanguage,
  QUOTE_LEADERBOARD_LANGUAGES,
} from "@monkeytype/schemas/leaderboards";
import { QuoteData } from "@monkeytype/schemas/quotes";
import { Mode } from "@monkeytype/schemas/shared";
import { Accessor, For, JSXElement, Show } from "solid-js";

import { isAuthenticated } from "../../../states/core";
import { Selection } from "../../../states/leaderboard-selection";
import { FaSolidIcon } from "../../../types/font-awesome";
import { Button } from "../../common/Button";
import SlimSelect from "../../ui/SlimSelect";

type GroupItem<T> = { id: T; text: string; icon: FaSolidIcon };

type LanguagesByModeByMode2 = Partial<Record<Mode, Record<string, Language[]>>>;

type ValidLeaderboards = Record<Selection["type"], LanguagesByModeByMode2>;

export type ModeSelect = Pick<Selection, "mode" | "mode2">;

export function Sidebar(props: {
  selection: Accessor<Selection>;
  onSelect: (selection: Selection) => void;
  validModeRules: ValidModeRule[];
  connectionsEnabled: boolean;
  weeklyXpEnabled: boolean;
  dailyEnabled: boolean;
  /** organizations (short names) to offer as a filter */
  organizations: string[];
  /** quotes of the selected quote leaderboard language */
  quotes: QuoteData["quotes"];
}): JSXElement {
  const updateSelection = (patch: Partial<Selection>) => {
    props.onSelect(
      normalizeSelection(
        { ...props.selection(), ...patch } as Selection,
        getValidLeaderboards(props.validModeRules),
      ),
    );
  };

  const selectType = (type: Selection["type"]) => {
    updateSelection({ type });
  };

  const selectMode = (value: ModeSelect) => {
    updateSelection({ mode: value.mode, mode2: value.mode2 });
  };

  const selectLanguage = (language: Language) => {
    updateSelection({ language });
  };
  const selectFriendsOnly = (friendsOnly: boolean) => {
    updateSelection({
      friendsOnly,
      organization: friendsOnly ? undefined : props.selection().organization,
    });
  };
  const selectOrganization = (organization: string | undefined) => {
    updateSelection({
      organization,
      friendsOnly:
        organization === undefined ? props.selection().friendsOnly : false,
    });
  };

  const quoteOptions = () => [
    { value: "all", text: "all quotes (average)" },
    ...props.quotes.map((quote) => ({
      value: `${quote.id}`,
      text: `#${quote.id} ${quote.source}`,
    })),
  ];

  const languageButtons = () =>
    props.selection().type === "weekly"
      ? []
      : props.selection().type === "quotes"
        ? QUOTE_LEADERBOARD_LANGUAGES.map((language) => ({
            id: language as Language,
            text: language,
            icon: "fa-globe" as const,
          }))
        : getLanguageButtons(
            getValidLeaderboards(props.validModeRules)[props.selection().type],
            props.selection().mode,
            props.selection().mode2,
          );

  return (
    <>
      <Group
        selected={props.selection().type}
        onSelect={selectType}
        items={(
          [
            {
              id: "allTime",
              text: "all-time",
              icon: "fa-globe-americas",
            },
            { id: "universities", text: "universities", icon: "fa-university" },
            { id: "quotes", text: "quotes", icon: "fa-quote-left" },
            { id: "weekly", text: "weekly xp", icon: "fa-calendar-day" },
            { id: "daily", text: "daily", icon: "fa-sun" },
          ] as GroupItem<Selection["type"]>[]
        ).filter(
          (item) =>
            (item.id !== "weekly" || props.weeklyXpEnabled) &&
            (item.id !== "daily" || props.dailyEnabled),
        )}
      />
      <Show
        when={
          isAuthenticated() &&
          props.connectionsEnabled &&
          props.selection().type !== "universities"
        }
      >
        <Group
          selected={props.selection().friendsOnly}
          onSelect={selectFriendsOnly}
          items={[
            { id: false, text: "everyone", icon: "fa-users" },
            { id: true, text: "friends only", icon: "fa-user-friends" },
          ]}
        />
      </Show>

      {/* wait for the quotes, the select would fall back to "all" otherwise */}
      <Show
        when={props.selection().type === "quotes" && props.quotes.length > 0}
      >
        <div class="mb-4 rounded-xl bg-sub-alt p-4">
          <SlimSelect
            options={quoteOptions()}
            selected={props.selection().mode2}
            onChange={(mode2) => {
              if (mode2 !== undefined && mode2 !== props.selection().mode2) {
                updateSelection({ mode2 });
              }
            }}
          />
        </div>
      </Show>
      <Show
        when={
          props.selection().type !== "weekly" &&
          props.selection().type !== "quotes"
        }
      >
        <Group
          selected={{
            mode: props.selection().mode,
            mode2: props.selection().mode2,
          }}
          onSelect={selectMode}
          items={getModeButtons(
            getValidLeaderboards(props.validModeRules)[props.selection().type],
            props.selection().language,
          )}
        />
      </Show>
      <Show when={languageButtons().length > 1}>
        <Group
          selected={props.selection().language}
          onSelect={selectLanguage}
          items={languageButtons()}
        />
      </Show>
      <Show
        when={
          (props.selection().type === "allTime" ||
            props.selection().type === "quotes") &&
          props.organizations.length > 0
        }
      >
        <Group<string | undefined>
          selected={props.selection().organization}
          onSelect={selectOrganization}
          items={[
            {
              id: undefined,
              text: "all universities",
              icon: "fa-globe-americas",
            },
            ...props.organizations.map((organization) => ({
              id: organization,
              text: organization,
              icon: "fa-university" as const,
            })),
          ]}
        />
      </Show>
    </>
  );
}

function Group<T>(props: {
  items: GroupItem<T>[];
  selected: T | undefined;
  onSelect: (selected: T) => void;
}): JSXElement {
  const isEqual = (a: unknown, b: unknown): boolean =>
    typeof a === "object" ? JSON.stringify(a) === JSON.stringify(b) : a === b;

  return (
    <div class="mb-4 grid gap-4 rounded-xl bg-sub-alt p-4">
      <For each={props.items}>
        {(item) => (
          <Button
            onClick={() => props.onSelect(item.id)}
            fa={{ icon: item.icon }}
            text={item.text}
            class="justify-start px-[0.75em]"
            active={isEqual(item.id, props.selected)}
          />
        )}
      </For>
    </div>
  );
}

function normalizeSelection(
  draft: Selection,
  valid: ValidLeaderboards,
): Selection {
  if (draft.type === "weekly") {
    return {
      ...draft,
      mode: undefined,
      mode2: undefined,
      language: undefined,
      organization: undefined,
      previous: false,
    };
  }
  if (draft.type === "quotes") {
    return {
      ...draft,
      mode: "quote",
      mode2: draft.mode === "quote" ? draft.mode2 : "all",
      language:
        draft.language !== undefined &&
        isQuoteLeaderboardLanguage(draft.language)
          ? draft.language
          : QUOTE_LEADERBOARD_LANGUAGES[0],
      previous: false,
    };
  }
  if (draft.type !== "allTime") {
    draft = { ...draft, organization: undefined };
  }
  if (draft.type === "universities") {
    draft = { ...draft, friendsOnly: false, previous: false };
  }

  let { mode, mode2, language } = draft;
  const validModes = valid[draft.type];

  if (validModes === undefined) throw new Error("no valid leaderboards");

  if (mode === null || validModes[mode] === undefined) {
    const firstMode = Object.keys(validModes).sort()[0] as Mode | undefined;
    if (!firstMode) {
      throw new Error(`No valid mode for type ${draft.type}`);
    }
    mode = firstMode;
  }

  const validMode2 = validModes[mode] as Record<string, Language[]>;

  if (mode2 === null || validMode2[mode2] === undefined) {
    const firstMode2 = Object.keys(validMode2).sort(
      (a, b) => parseInt(a) - parseInt(b),
    )[0];
    if (firstMode2 === undefined) {
      throw new Error(`No valid mode2 for ${draft.type}:${mode}`);
    }
    mode2 = firstMode2;
  }

  const supportedLanguages = validMode2[mode2];
  if (!supportedLanguages || supportedLanguages.length === 0) {
    throw new Error(`Invalid leaderboard config for ${mode}:${mode2}`);
  }

  if (!language || !supportedLanguages.includes(language)) {
    language = supportedLanguages.sort()[0] as Language;
  }

  return { ...draft, mode, mode2, language };
}

function getModeButtons(
  valid: LanguagesByModeByMode2,
  language?: Language,
): GroupItem<ModeSelect>[] {
  const modes = Object.entries(valid).flatMap(([mode, mode2List]) =>
    Object.entries(mode2List)
      .filter(
        ([_, languages]) =>
          language === undefined || languages.includes(language),
      )
      .flatMap(([mode2]) => ({
        id: { mode, mode2 },
        text: `${mode} ${mode2}`,
        icon: mode === "time" ? "fa-clock" : "fa-align-left",
      })),
  );

  return modes as GroupItem<ModeSelect>[];
}

function getLanguageButtons(
  valid: LanguagesByModeByMode2,
  mode: Mode | undefined,
  mode2: string | undefined,
): GroupItem<Language>[] {
  if (mode === undefined || mode2 === undefined) return [];

  return (valid[mode]?.[mode2] ?? []).map((language) => ({
    id: language,
    text: language,
    icon: "fa-globe",
  }));
}
function getValidLeaderboards(
  validModeRules: ValidModeRule[],
): ValidLeaderboards {
  //a rule can contain multiple values. create a flat list out of them
  const dailyRules = validModeRules.flatMap((rule) => {
    const languages = convertRuleOption(rule.language) as Language[];
    const mode2List = convertRuleOption(rule.mode2);

    return mode2List.map((mode2) => ({
      mode: rule.mode as Mode,
      mode2,
      languages,
    }));
  });

  const allTime = {
    time: {
      "15": [...ALL_TIME_LEADERBOARD_LANGUAGES],
      "60": [...ALL_TIME_LEADERBOARD_LANGUAGES],
    },
  };

  return {
    allTime,
    universities: allTime,
    // quote leaderboards are not picked by mode, see normalizeSelection
    quotes: {},
    weekly: {},
    daily: dailyRules.reduce<
      Partial<Record<Mode, Record<string /*mode2*/, Language[]>>>
    >((acc, { mode, mode2, languages }) => {
      let modes = acc[mode];
      if (modes === undefined) {
        modes = {};
        acc[mode] = modes;
      }

      let modes2 = modes[mode2];
      if (modes2 === undefined) {
        modes2 = [];
        modes[mode2] = modes2;
      }

      modes2.push(...languages);
      return acc;
    }, {}),
  };
}

function convertRuleOption(rule: string): string[] {
  return rule.startsWith("(") ? rule.slice(1, -1).split("|") : [rule];
}
