import { JSXElement, Show } from "solid-js";

import { getProgcompProfileUrl } from "../../utils/progcomp";
import { Button } from "./Button";

/** links to the user's profile on the ProgCompJOliva website */
export function ProgcompProfileLink(props: {
  nickname: string | undefined;
  text?: string;
  class?: string;
}): JSXElement {
  return (
    <Show when={props.nickname}>
      {(nickname) => (
        <Button
          variant="text"
          href={getProgcompProfileUrl(nickname())}
          fa={{ icon: "fa-external-link-alt", fixedWidth: true }}
          text={props.text}
          balloon={{ text: "ProgCompJOliva profile" }}
          class={props.class}
        />
      )}
    </Show>
  );
}
