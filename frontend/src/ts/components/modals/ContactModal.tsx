import { JSXElement } from "solid-js";

import { getProgcompSiteUrl } from "../../utils/progcomp";
import { AnimatedModal } from "../common/AnimatedModal";
import { Button } from "../common/Button";

export function ContactModal(): JSXElement {
  const buttonClass = " gap-4 text-md p-4 text-lg justify-start";

  return (
    <AnimatedModal id="Contact" modalClass="max-w-4xl" title="Contact">
      <div>
        progcompea type is run by the ProgCompJOliva community. For questions,
        feedback or bug reports, reach out to the ProgCompJOliva admins.
        <br />
        <br />
        Your nickname, email, password and university come from your
        ProgCompJOliva account, change them there. Personal bests and typing
        data can be reset in the{" "}
        <a href="/account-settings">account settings</a> page.
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <Button
          variant="button"
          href={getProgcompSiteUrl()}
          text="ProgCompJOliva"
          class={buttonClass}
          fa={{
            icon: "fa-external-link-alt",
            fixedWidth: true,
          }}
        />
        <Button
          variant="button"
          href="https://github.com/monkeytypegame/monkeytype"
          text="Monkeytype (the original)"
          class={buttonClass}
          fa={{
            icon: "fa-code",
            fixedWidth: true,
          }}
        />
      </div>
    </AnimatedModal>
  );
}
