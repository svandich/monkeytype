import { createSignal, Show } from "solid-js";

import { getAuthenticatedUserEmailReactive } from "../../../auth";
import { Button } from "../../common/Button";
import { Section } from "./utils";

export function AuthenticationTab() {
  return <PasswordAuthentication />;
}

function PasswordAuthentication() {
  return (
    <Section
      title="ProgCompJOliva account"
      fa={{ icon: "fa-lock" }}
      description=<>
        You sign in with your ProgCompJOliva account. Change your email or
        password there.
      </>
    >
      <AuthEmail />
    </Section>
  );
}

function AuthEmail() {
  const [isRevealed, setIsRevealed] = createSignal(false);
  const email = () => getAuthenticatedUserEmailReactive();

  return (
    <Show when={email()}>
      {(value) => (
        <Button
          variant="text"
          class="w-full p-1 font-mono"
          fa={{ icon: isRevealed() ? "fa-eye-slash" : "fa-eye" }}
          text={isRevealed() ? value() : obfuscateEmail(value())}
          balloon={{
            text: isRevealed() ? "click to hide" : "click to reveal",
          }}
          onClick={() => setIsRevealed(!isRevealed())}
        />
      )}
    </Show>
  );
}

function obfuscateEmail(email: string): string {
  const atIndex = email.lastIndexOf("@");
  if (atIndex < 1) return maskAfterFirstCharacter(email);

  const domain = email.slice(atIndex + 1);
  const dotIndex = domain.lastIndexOf(".");
  const maskedDomain =
    dotIndex < 1
      ? maskAfterFirstCharacter(domain)
      : `${maskAfterFirstCharacter(domain.slice(0, dotIndex))}${domain.slice(dotIndex)}`;

  return `${maskAfterFirstCharacter(email.slice(0, atIndex))}@${maskedDomain}`;
}

function maskAfterFirstCharacter(value: string): string {
  if (value.length <= 1) return "\u2022".repeat(3);
  return `${value.slice(0, 1)}${"\u2022".repeat(value.length - 1)}`;
}
