import { useQuery } from "@tanstack/solid-query";
import { createEffect, createSignal } from "solid-js";

import Ape from "../../../ape";
import { getConfigurationQuery, invalidateAdmin } from "../../../queries/admin";
import { getActivePage } from "../../../states/core";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../../states/notifications";
import { cn } from "../../../utils/cn";
import AsyncContent from "../../common/AsyncContent";
import { Button } from "../../common/Button";
import { Section } from "../account-settings/utils";
import { inputClass } from "./UsersTab";

export function ConfigurationTab() {
  const configuration = useQuery(() => ({
    ...getConfigurationQuery(),
    enabled: getActivePage() === "admin",
  }));
  const [text, setText] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  const reset = (): void => {
    if (configuration.data !== undefined) {
      setText(JSON.stringify(configuration.data, null, 2));
    }
  };
  createEffect(reset);

  const save = async (): Promise<void> => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text());
    } catch (e) {
      showErrorNotification("Invalid JSON", { error: e });
      return;
    }

    setSaving(true);
    try {
      const response = await Ape.configuration.update({
        // the backend validates it against the configuration schema
        body: { configuration: parsed as never },
      });
      if (response.status !== 200) {
        const details =
          "validationErrors" in response.body
            ? `: ${response.body.validationErrors.join(", ")}`
            : "";
        showErrorNotification(`${response.body.message}${details}`);
        return;
      }
      await invalidateAdmin();
      showSuccessNotification("Configuration saved");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Section
        title="server configuration"
        fa={{ icon: "fa-sliders-h" }}
        description="Live server configuration, stored in the database. Only the values you change are updated. Values in backend-configuration.json are applied again on every backend start."
        fullWidth
      />
      <AsyncContent
        queries={{ configuration }}
        errorMessage="Failed to load configuration"
      >
        {() => (
          <div class="grid gap-2">
            <textarea
              class={cn(inputClass, "h-[60vh] resize-y font-mono text-em-sm")}
              value={text()}
              onInput={(e) => setText(e.currentTarget.value)}
            ></textarea>
            <div class="flex justify-end gap-2">
              <Button text="reset" onClick={reset} disabled={saving()} />
              <Button
                text="save"
                fa={{ icon: "fa-save" }}
                onClick={() => void save()}
                disabled={saving()}
              />
            </div>
          </div>
        )}
      </AsyncContent>
    </>
  );
}
