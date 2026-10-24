import { queryOptions } from "@tanstack/solid-query";
import { baseKey } from "./utils/keys";
import Ape from "../ape";
import { queryClient } from ".";

const queryKeys = {
  root: () => baseKey("admin", { isUserSpecific: true }),
  access: () => [...queryKeys.root(), "access"],
  reports: () => [...queryKeys.root(), "reports"],
  user: (search: string) => [...queryKeys.root(), "user", search],
  configuration: () => [...queryKeys.root(), "configuration"],
};

/**
 * "granted" for admins, "disabled" while the admin endpoints are switched off
 * in the server configuration, "denied" for everyone else
 */
export type AdminAccess = "granted" | "disabled" | "denied";

// oxlint-disable-next-line typescript/explicit-function-return-type
export const getAdminAccessQuery = () =>
  queryOptions({
    queryKey: queryKeys.access(),
    queryFn: async (): Promise<AdminAccess> => {
      const response = await Ape.admin.test();
      if (response.status === 200) return "granted";
      if (response.status === 403) return "denied";
      if (response.status === 503) {
        // the disabled check runs before the permission check, the schema
        // endpoint needs admin too but is not affected by admin.endpointsEnabled
        const schema = await Ape.configuration.getSchema();
        if (schema.status === 200) return "disabled";
        if (schema.status === 403) return "denied";
      }
      throw new Error(`Failed to check admin access: ${response.body.message}`);
    },
    retry: false,
  });

// oxlint-disable-next-line typescript/explicit-function-return-type
export const getReportsQuery = () =>
  queryOptions({
    queryKey: queryKeys.reports(),
    queryFn: async () => {
      const response = await Ape.admin.getReports();
      if (response.status !== 200) {
        throw new Error(`Failed to load reports: ${response.body.message}`);
      }
      return response.body.data;
    },
  });

// oxlint-disable-next-line typescript/explicit-function-return-type
export const getAdminUserQuery = (search: string) =>
  queryOptions({
    queryKey: queryKeys.user(search),
    queryFn: async () => {
      const response = await Ape.admin.findUser({ query: { search } });
      if (response.status !== 200) {
        throw new Error(`Failed to find user: ${response.body.message}`);
      }
      // wrapped, AsyncContent treats null as not loaded yet
      return { user: response.body.data };
    },
    retry: false,
  });

// oxlint-disable-next-line typescript/explicit-function-return-type
export const getConfigurationQuery = () =>
  queryOptions({
    queryKey: queryKeys.configuration(),
    queryFn: async () => {
      const response = await Ape.configuration.get();
      if (response.status !== 200) {
        throw new Error(
          `Failed to load configuration: ${response.body.message}`,
        );
      }
      return response.body.data;
    },
  });

export async function invalidateAdmin(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.root() });
}
