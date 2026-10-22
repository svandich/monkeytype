import { queryOptions } from "@tanstack/solid-query";
import { envConfig } from "virtual:env-config";
import { z } from "zod";
import { getProgcompApiAssetUrl } from "../utils/progcomp";
import { baseKey } from "./utils/keys";

const OrganizationSchema = z.object({
  shortName: z.string(),
  name: z.string(),
  logoUrl: z.string().nullish(),
});

export type Organization = {
  shortName: string;
  name: string;
  logoUrl?: string;
};

const queryKeys = {
  organizations: () => baseKey("progcompOrganizations"),
};

/** organizations (universities) from ProgCompJOlivaApi, by short name */
// oxlint-disable-next-line typescript/explicit-function-return-type
export const getOrganizationsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.organizations(),
    queryFn: async () => {
      const response = await fetch(
        `${envConfig.progcompApiUrl}/api/organizations`,
      );
      if (!response.ok) {
        throw new Error(`Could not fetch organizations: ${response.status}`);
      }
      const organizations = z
        .array(OrganizationSchema)
        .parse(await response.json());

      return new Map<string, Organization>(
        organizations.map((it) => [
          it.shortName,
          {
            shortName: it.shortName,
            name: it.name,
            logoUrl:
              it.logoUrl !== null && it.logoUrl !== undefined
                ? getProgcompApiAssetUrl(it.logoUrl)
                : undefined,
          },
        ]),
      );
    },
    staleTime: 1000 * 60 * 60,
  });
