import { OrganizationLeaderboardEntry } from "@monkeytype/schemas/leaderboards";
import { For, JSXElement } from "solid-js";

import { getSnapshot } from "../../../db";
import { getFormatting } from "../../../states/core";
import { cn } from "../../../utils/cn";
import { getDisplayName } from "../../../utils/progcomp";
import { Button } from "../../common/Button";
import { Fa } from "../../common/Fa";
import { Organization } from "../../common/Organization";
import { DataTable, DataTableColumnDef } from "../../ui/table/DataTable";

/**
 * Universities ranked by the average speed of their best typists (missing
 * team members count as 0).
 */
export function OrganizationTable(props: {
  entries: OrganizationLeaderboardEntry[];
}): JSXElement {
  return (
    <DataTable
      id="organizationLeaderboardTable"
      class={cn(
        "table-auto [&>tbody>tr>td]:py-3 [&>tbody>tr>td]:whitespace-nowrap [&>thead>tr>th]:align-middle",
        "[&>tbody>tr>td]:px-2 [&>tbody>tr>td]:text-[0.75em] [&>thead>tr>th]:px-2 [&>thead>tr>th]:text-[0.75em]",
        "sm:[&>tbody>tr>td]:px-4 sm:[&>tbody>tr>td]:text-[1em] sm:[&>thead>tr>th]:px-4 sm:[&>thead>tr>th]:text-[1em]",
      )}
      columns={getColumns()}
      data={props.entries}
      rowSelection={{
        getRowId: (row) => row.organization,
        activeRow: () => getSnapshot()?.progcomp?.organization ?? null,
        class: "text-main [&>td>div]:text-main",
      }}
      noDataRow={{
        content: (
          <div class="flex flex-row items-center justify-center rounded bg-sub-alt p-4 text-text">
            <div>No universities on this leaderboard yet ¯\_(ツ)_/¯</div>
          </div>
        ),
      }}
    />
  );
}

type Entry = OrganizationLeaderboardEntry;

function getColumns(): DataTableColumnDef<Entry>[] {
  const format = getFormatting();

  // plain column defs, the column helper's deep key inference gives up on the nested team array
  const columns: DataTableColumnDef<Entry>[] = [
    {
      id: "rank",
      accessorFn: (row) => row.rank,
      header: () => <Fa icon="fa-hashtag" />,
      cell: (info: { getValue: () => number }) =>
        info.getValue() === 1 ? <Fa icon="fa-crown" /> : info.getValue(),
      meta: { align: "center" },
    },
    {
      id: "organization",
      accessorFn: (row) => row.organization,
      header: "university",
      cell: (info: { getValue: () => string }) => (
        <Organization shortName={info.getValue()} />
      ),
    },
    {
      id: "score",
      accessorFn: (row) => row.score,
      header: `team ${format.typingSpeedUnit}`,
      cell: (info: { getValue: () => number }) =>
        format.typingSpeed(info.getValue(), { showDecimalPlaces: true }),
      meta: {
        align: "right",
        headerMeta: {
          "aria-label": "average of the 3 fastest typists",
          "data-balloon-pos": "down",
        },
      },
    },
    {
      id: "team",
      accessorFn: (row) => row.team,
      header: "fastest typists",
      cell: (info: { getValue: () => Entry["team"] }) => (
        <div class="flex flex-wrap gap-x-4 gap-y-1">
          <For each={info.getValue()}>
            {(member) => (
              <span class="inline-flex items-center gap-1">
                <Button
                  variant="text"
                  href={`/profile/${member.name}`}
                  router-link
                  text={getDisplayName(member)}
                  class="px-0 text-text"
                />
                <span class="text-sub">
                  {format.typingSpeed(member.wpm, { showDecimalPlaces: false })}
                </span>
              </span>
            )}
          </For>
        </div>
      ),
      meta: { cellMeta: () => ({ class: "w-full" }) },
    },
    {
      id: "members",
      accessorFn: (row) => row.members,
      header: "typists",
      cell: (info: { getValue: () => number }) => info.getValue(),
      meta: { align: "right" },
    },
  ];

  return columns.map((it) => ({ ...it, enableSorting: false }));
}
