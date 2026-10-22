import { useQuery } from "@tanstack/solid-query";
import { JSXElement, Show } from "solid-js";

import { getOrganizationsQueryOptions } from "../../queries/progcomp";
import { cn } from "../../utils/cn";
import { Balloon } from "./Balloon";
import { Fa } from "./Fa";

/** an organization (university) logo and short name, with the full name on hover */
export function Organization(props: {
  shortName: string | undefined;
  hideName?: boolean;
  class?: string;
}): JSXElement {
  const organizationsQuery = useQuery(() => getOrganizationsQueryOptions());

  const organization = () =>
    props.shortName === undefined
      ? undefined
      : organizationsQuery.data?.get(props.shortName);

  return (
    <Show when={props.shortName}>
      {(shortName) => (
        <Balloon
          inline
          text={organization()?.name ?? shortName()}
          class={cn(
            "inline-flex items-center gap-[0.4em] text-sub",
            props.class,
          )}
        >
          <Show
            when={organization()?.logoUrl}
            fallback={<Fa icon="fa-university" />}
          >
            {(logoUrl) => (
              <img
                src={logoUrl()}
                alt=""
                loading="lazy"
                class="h-[1.25em] w-[1.25em] object-contain"
              />
            )}
          </Show>
          <Show when={props.hideName !== true}>
            <span>{shortName()}</span>
          </Show>
        </Balloon>
      )}
    </Show>
  );
}
