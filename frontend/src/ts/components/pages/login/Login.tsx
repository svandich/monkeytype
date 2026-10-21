import { createForm } from "@tanstack/solid-form";
import { JSXElement } from "solid-js";

import { AuthResult, signIn } from "../../../auth";
import {
  disableLoginPageInputs,
  enableLoginPageInputs,
  getLoginPageInputsEnabled,
} from "../../../states/login";
import {
  showErrorNotification,
  showNoticeNotification,
} from "../../../states/notifications";
import { H3 } from "../../common/Headers";
import { Checkbox } from "../../ui/form/Checkbox";
import { InputField } from "../../ui/form/InputField";
import { SubmitButton } from "../../ui/form/SubmitButton";
import { allFieldsMandatory } from "../../ui/form/utils";

export function Login(): JSXElement {
  const trySignIn = async (auth: () => Promise<AuthResult>): Promise<void> => {
    disableLoginPageInputs();
    try {
      const data = await auth();
      if (!data.success) {
        showErrorNotification(`Failed to sign in: ${data.message}`);
      }
    } finally {
      enableLoginPageInputs();
    }
  };

  const form = createForm(() => ({
    defaultValues: {
      nickname: "",
      password: "",
      rememberMe: true,
    },
    onSubmit: async ({ value }) =>
      await trySignIn(async () =>
        signIn(value.nickname, value.password, value.rememberMe),
      ),
    onSubmitInvalid: () => {
      showNoticeNotification("Please fill in all fields");
    },
    validators: {
      onChange: allFieldsMandatory(),
    },
  }));

  return (
    <div class="grid w-full grid-cols-1 justify-center gap-2 sm:w-80">
      <H3
        text="login with ProgCompJOliva"
        fa={{
          icon: "fa-sign-in-alt",
        }}
        class="p-0"
      />
      <form
        class="grid w-full gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="nickname"
          children={(field) => (
            <InputField
              field={field}
              placeholder="nickname"
              autocomplete="username"
              disabled={!getLoginPageInputsEnabled()}
            />
          )}
        />
        <form.Field
          name="password"
          children={(field) => (
            <InputField
              field={field}
              placeholder="password"
              type="password"
              autocomplete="current-password"
              disabled={!getLoginPageInputsEnabled()}
            />
          )}
        />
        <form.Field
          name="rememberMe"
          children={(field) => (
            <Checkbox
              field={field}
              disabled={!getLoginPageInputsEnabled()}
              label="remember me"
            />
          )}
        />

        <SubmitButton
          form={form}
          fa={{ icon: "fa-sign-in-alt" }}
          text="sign in"
          disabled={!getLoginPageInputsEnabled()}
        />
      </form>

      <p class="text-right text-xs text-sub">
        accounts and passwords are managed in ProgCompJOliva
      </p>
    </div>
  );
}
