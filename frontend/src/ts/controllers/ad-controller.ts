import { onDOMReady, qsa } from "../utils/dom";

/**
 * Ads are disabled. No third party ad or tracking scripts are loaded.
 * Kept as a no-op so callers don't need to change.
 */

export async function reinstate(): Promise<boolean> {
  return false;
}

export async function renderResult(): Promise<void> {
  //
}

export function updateFooterAndVerticalAds(_visible: boolean): void {
  //
}

export function destroyResult(): void {
  //
}

onDOMReady(() => {
  qsa("[id^='ad-'][id$='-wrapper']").remove();
});
