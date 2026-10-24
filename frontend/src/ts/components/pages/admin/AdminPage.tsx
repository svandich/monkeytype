import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement, Match, Switch } from "solid-js";

import Ape from "../../../ape";
import { getAdminAccessQuery, invalidateAdmin } from "../../../queries/admin";
import {
  AdminTab,
  adminTabs,
  getAdminTab,
  setAdminTab,
} from "../../../states/admin";
import { getActivePage, isAuthenticated } from "../../../states/core";
import { showSimpleModal } from "../../../states/simple-modal";
import AsyncContent from "../../common/AsyncContent";
import { Button } from "../../common/Button";
import { Page } from "../../common/Page";
import { Section } from "../account-settings/utils";
import { ConfigurationTab } from "./ConfigurationTab";
import { ReportsTab } from "./ReportsTab";
import { UsersTab } from "./UsersTab";

const tabContent: Record<AdminTab, () => JSXElement> = {
  users: () => <UsersTab />,
  reports: () => <ReportsTab />,
  configuration: () => <ConfigurationTab />,
};

export function AdminPage() {
  const access = useQuery(() => ({
    ...getAdminAccessQuery(),
    enabled: getActivePage() === "admin" && isAuthenticated(),
  }));

  return (
    <Page id="admin" needsAuthentication>
      <AsyncContent
        queries={{ access }}
        errorMessage="Failed to check admin access"
      >
        {({ accessData }) => (
          <Switch>
            <Match when={accessData() === "denied"}>
              <div class="text-center text-sub">
                You don&lsquo;t have admin permissions.
              </div>
            </Match>
            <Match when={accessData() === "disabled"}>
              <EndpointsDisabled />
            </Match>
            <Match when={accessData() === "granted"}>
              <div class="content-grid flex flex-col gap-8 md:flex-row">
                <div class="w-full shrink-0 md:w-60">
                  <Sidebar />
                </div>
                <div class="flex w-full min-w-0 flex-1 flex-col gap-8">
                  {tabContent[getAdminTab()]()}
                </div>
              </div>
            </Match>
          </Switch>
        )}
      </AsyncContent>
    </Page>
  );
}

function Sidebar() {
  return (
    <div class="flex flex-col gap-4 rounded-double bg-sub-alt p-4 md:items-start">
      <For each={Object.entries(adminTabs)}>
        {([key, tab]) => (
          <Button
            text={tab.text}
            variant="text"
            fa={{ icon: tab.icon }}
            active={getAdminTab() === key}
            class="[--themable-button-active:var(--themable-button-text)]"
            onClick={() => setAdminTab(key as AdminTab)}
          />
        )}
      </For>
    </div>
  );
}

// the configuration endpoints are not affected by admin.endpointsEnabled
function EndpointsDisabled() {
  return (
    <Section
      title="admin endpoints disabled"
      fa={{ icon: "fa-user-shield" }}
      description="The admin endpoints are switched off in the server configuration."
      button={{
        text: "enable",
        onClick: () =>
          showSimpleModal({
            title: "Enable admin endpoints?",
            buttonText: "enable",
            execFn: async () => {
              const response = await Ape.configuration.update({
                body: { configuration: { admin: { endpointsEnabled: true } } },
              });
              if (response.status !== 200) {
                return { status: "error", message: response.body.message };
              }
              await invalidateAdmin();
              return { status: "success", message: "Admin endpoints enabled" };
            },
          }),
      }}
    />
  );
}
