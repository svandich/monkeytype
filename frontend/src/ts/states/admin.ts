import { createSignal } from "solid-js";
import { FaSolidIcon } from "../types/font-awesome";

export type AdminTab = "users" | "reports" | "configuration";

export const adminTabs: Record<AdminTab, { icon: FaSolidIcon; text: string }> =
  {
    users: { text: "users", icon: "fa-users" },
    reports: { text: "reports", icon: "fa-flag" },
    configuration: { text: "configuration", icon: "fa-sliders-h" },
  };

export const [getAdminTab, setAdminTab] = createSignal<AdminTab>("users");

/** uid, name or nickname looked up on the users tab */
export const [getAdminUserSearch, setAdminUserSearch] = createSignal<
  string | undefined
>(undefined);

export function openAdminUser(search: string): void {
  setAdminUserSearch(search);
  setAdminTab("users");
}
