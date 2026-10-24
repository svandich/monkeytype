import { AdminReport } from "@monkeytype/contracts/admin";
import { useQuery } from "@tanstack/solid-query";
import { createColumnHelper } from "@tanstack/solid-table";
import { format } from "date-fns/format";
import { createMemo, JSXElement } from "solid-js";
import { z } from "zod";

import Ape from "../../../ape";
import { getReportsQuery, invalidateAdmin } from "../../../queries/admin";
import { openAdminUser } from "../../../states/admin";
import { getActivePage } from "../../../states/core";
import { showSimpleModal } from "../../../states/simple-modal";
import AsyncContent from "../../common/AsyncContent";
import { Button } from "../../common/Button";
import { DataTable, DataTableColumnDef } from "../../ui/table/DataTable";
import { Section } from "../account-settings/utils";

export function ReportsTab() {
  const reports = useQuery(() => ({
    ...getReportsQuery(),
    enabled: getActivePage() === "admin",
  }));
  const columns = createMemo(getColumns);

  return (
    <>
      <Section
        title="reports"
        fa={{ icon: "fa-flag" }}
        description="Quote and user reports. Accepting or rejecting a report removes it and notifies the reporter in their inbox."
        button={{
          text: "refresh",
          onClick: () => void invalidateAdmin(),
        }}
      />
      <AsyncContent queries={{ reports }} errorMessage="Failed to load reports">
        {({ reportsData }) => (
          <DataTable
            id="adminReports"
            columns={columns()}
            data={reportsData()}
            fallback={<div class="text-center text-sub">No open reports.</div>}
          />
        )}
      </AsyncContent>
    </>
  );
}

function UserButton(props: { uid: string; name?: string }): JSXElement {
  return (
    <Button
      variant="text"
      text={props.name ?? props.uid}
      balloon={{ text: "open user" }}
      onClick={() => openAdminUser(props.uid)}
    />
  );
}

function getColumns(): DataTableColumnDef<AdminReport>[] {
  const defineColumn = createColumnHelper<AdminReport>().accessor;

  const columns = [
    defineColumn("timestamp", {
      header: "date",
      cell: (info) => format(info.getValue(), "dd MMM yyyy HH:mm"),
    }),
    defineColumn("uid", {
      header: "reporter",
      cell: (info) => (
        <UserButton
          uid={info.getValue()}
          name={info.row.original.reporterName}
        />
      ),
    }),
    defineColumn("contentId", {
      header: "reported",
      cell: (info) =>
        info.row.original.type === "user" ? (
          <UserButton
            uid={info.getValue()}
            name={info.row.original.contentName}
          />
        ) : (
          `quote ${info.getValue()}`
        ),
    }),
    defineColumn("reason", {
      header: "reason",
    }),
    defineColumn("comment", {
      header: "comment",
      cell: (info) => <div class="break-words">{info.getValue()}</div>,
    }),
    defineColumn("id", {
      header: "",
      cell: (info) => (
        <div class="flex justify-end gap-2">
          <Button
            fa={{ fixedWidth: true, icon: "fa-check" }}
            balloon={{ text: "accept" }}
            onClick={() => showAcceptModal(info.row.original)}
          />
          <Button
            fa={{ fixedWidth: true, icon: "fa-times" }}
            balloon={{ text: "reject" }}
            onClick={() => showRejectModal(info.row.original)}
          />
        </div>
      ),
    }),
  ];

  return columns.map((it) => ({ ...it, enableSorting: false }));
}

function showAcceptModal(report: AdminReport): void {
  showSimpleModal({
    title: "Accept report?",
    text: "The report is removed and the reporter is told it was approved. Act on the reported content separately.",
    buttonText: "accept",
    execFn: async () => {
      const response = await Ape.admin.acceptReports({
        body: { reports: [{ reportId: report.id }] },
      });
      if (response.status !== 200) {
        return { status: "error", message: response.body.message };
      }
      await invalidateAdmin();
      return { status: "success", message: "Report accepted" };
    },
  });
}

function showRejectModal(report: AdminReport): void {
  showSimpleModal({
    title: "Reject report?",
    buttonText: "reject",
    schema: z.object({ reason: z.string().max(500) }),
    inputs: {
      reason: { type: "text", placeholder: "reason (optional)" },
    },
    execFn: async ({ reason }) => {
      const response = await Ape.admin.rejectReports({
        body: {
          reports: [
            {
              reportId: report.id,
              ...(reason.trim() !== "" ? { reason: reason.trim() } : {}),
            },
          ],
        },
      });
      if (response.status !== 200) {
        return { status: "error", message: response.body.message };
      }
      await invalidateAdmin();
      return { status: "success", message: "Report rejected" };
    },
  });
}
