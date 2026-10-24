import { JSXElement, Show } from "solid-js";

import { getProgcompProfileUrl } from "../../utils/progcomp";
import { Button } from "./Button";
import { Fa } from "./Fa";

/** links to the user's profile on the ProgCompJOliva website */
export function ProgcompProfileLink(props: {
  nickname: string | undefined;
  text?: string;
  /** show the ProgCompJOliva logo next to the arrow */
  logo?: boolean;
  class?: string;
}): JSXElement {
  return (
    <Show when={props.nickname}>
      {(nickname) => (
        <Button
          variant="text"
          href={getProgcompProfileUrl(nickname())}
          fa={
            props.logo
              ? undefined
              : { icon: "fa-external-link-alt", fixedWidth: true }
          }
          text={props.text}
          balloon={{ text: "ProgCompJOliva profile" }}
          class={props.class}
        >
          <Show when={props.logo}>
            <img
              src="/images/progcompea/progcomp-logo.svg"
              alt="ProgCompJOliva"
              class="h-[1.25em] w-auto"
            />
            <Fa icon="fa-external-link-alt" />
          </Show>
        </Button>
      )}
    </Show>
  );
}
