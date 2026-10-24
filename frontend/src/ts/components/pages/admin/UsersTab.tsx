import { AdminUser } from "@monkeytype/contracts/admin";
import { useQuery } from "@tanstack/solid-query";
import { format } from "date-fns/format";
import { createSignal, For, JSXElement, Show } from "solid-js";

import Ape from "../../../ape";
import { getAdminUserQuery, invalidateAdmin } from "../../../queries/admin";
import { getAdminUserSearch, setAdminUserSearch } from "../../../states/admin";
import { ExecReturn, showSimpleModal } from "../../../states/simple-modal";
import { secondsToString } from "../../../utils/date-and-time";
import AsyncContent from "../../common/AsyncContent";
import { Button } from "../../common/Button";
import { Section } from "../account-settings/utils";

export const inputClass =
  "w-full rounded border-none bg-sub-alt p-[0.5em] text-em-base leading-[1.25em] caret-main outline-none focus-visible:shadow-[0_0_0_0.1rem_var(--bg-color),0_0_0_0.2rem_var(--text-color)]";

export function UsersTab() {
  const [input, setInput] = createSignal(getAdminUserSearch() ?? "");
  const user = useQuery(() => ({
    ...getAdminUserQuery(getAdminUserSearch() ?? ""),
    enabled: getAdminUserSearch() !== undefined,
  }));

  return (
    <>
      <Section
        title="find user"
        fa={{ icon: "fa-search" }}
        description="Search by ProgCompJOliva nickname, monkeytype name or uid."
        fullWidth
      >
        <form
          class="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const search = input().trim();
            if (search !== "") setAdminUserSearch(search);
          }}
        >
          <input
            class={inputClass}
            placeholder="nickname, name or uid"
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
          />
          <Button type="submit" fa={{ icon: "fa-chevron-right" }} />
        </form>
      </Section>
      <Show when={getAdminUserSearch() !== undefined}>
        <AsyncContent queries={{ user }} errorMessage="Failed to find user">
          {({ userData }) => (
            <Show
              when={userData().user}
              fallback={<div class="text-center text-sub">User not found.</div>}
            >
              {(found) => <UserDetails user={found()} />}
            </Show>
          )}
        </AsyncContent>
      </Show>
    </>
  );
}

function UserDetails(props: { user: AdminUser }): JSXElement {
  const details = (): [string, string][] => [
    ["nickname", props.user.nickname ?? "-"],
    ["name", props.user.name],
    ["uid", props.user.uid],
    ["email", props.user.email],
    ["organization", props.user.organization ?? "-"],
    ["joined", format(props.user.addedAt, "dd MMM yyyy HH:mm")],
    ["tests completed", `${props.user.completedTests ?? 0}`],
    [
      "time typing",
      secondsToString(Math.round(props.user.timeTyping ?? 0), true, true),
    ],
    ["streak hour offset", `${props.user.streakHourOffset ?? "-"}`],
    ["banned", props.user.banned ? "yes" : "no"],
  ];

  const name = () => props.user.nickname ?? props.user.name;

  return (
    <div class="grid gap-4 rounded-double bg-sub-alt p-4">
      <div class="grid grid-cols-[auto_1fr] gap-x-8 gap-y-1">
        <For each={details()}>
          {([label, value]) => (
            <>
              <div class="text-sub">{label}</div>
              <div class="break-all">{value}</div>
            </>
          )}
        </For>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          text="profile"
          fa={{ icon: "fa-globe-americas" }}
          href={`/profile/${props.user.name}`}
          router-link
        />
        <Button
          text={props.user.banned ? "unban" : "ban"}
          fa={{ icon: "fa-gavel" }}
          onClick={() =>
            confirm({
              title: `${props.user.banned ? "Unban" : "Ban"} ${name()}?`,
              text: props.user.banned
                ? undefined
                : "Banned users are removed from the leaderboards.",
              buttonText: props.user.banned ? "unban" : "ban",
              action: async () => {
                const response = await Ape.admin.toggleBan({
                  body: { uid: props.user.uid },
                });
                if (response.status !== 200) return response.body.message;
                return undefined;
              },
              successMessage: props.user.banned
                ? "User unbanned"
                : "User banned",
            })
          }
        />
        <Show when={props.user.streakHourOffset !== undefined}>
          <Button
            text="clear streak hour offset"
            fa={{ icon: "fa-clock" }}
            onClick={() =>
              confirm({
                title: `Clear the streak hour offset of ${name()}?`,
                buttonText: "clear",
                action: async () => {
                  const response = await Ape.admin.clearStreakHourOffset({
                    body: { uid: props.user.uid },
                  });
                  if (response.status !== 200) return response.body.message;
                  return undefined;
                },
                successMessage: "Streak hour offset cleared",
              })
            }
          />
        </Show>
        <Button
          text="delete"
          fa={{ icon: "fa-trash-alt" }}
          danger
          onClick={() =>
            confirm({
              title: `Delete ${name()}?`,
              text: "All their typing data is deleted. Their ProgCompJOliva account is not affected, signing in again creates a fresh profile.",
              buttonText: "delete",
              action: async () => {
                const response = await Ape.admin.deleteUser({
                  body: { uid: props.user.uid },
                });
                if (response.status !== 200) return response.body.message;
                setAdminUserSearch(undefined);
                return undefined;
              },
              successMessage: "User deleted",
            })
          }
        />
      </div>
    </div>
  );
}

function confirm(options: {
  title: string;
  text?: string;
  buttonText: string;
  /** resolves to an error message on failure */
  action: () => Promise<string | undefined>;
  successMessage: string;
}): void {
  showSimpleModal({
    title: options.title,
    text: options.text,
    buttonText: options.buttonText,
    execFn: async (): Promise<ExecReturn> => {
      const error = await options.action();
      if (error !== undefined) return { status: "error", message: error };
      await invalidateAdmin();
      return { status: "success", message: options.successMessage };
    },
  });
}
