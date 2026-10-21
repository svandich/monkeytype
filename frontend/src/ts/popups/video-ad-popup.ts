import {
  showNoticeNotification,
  showErrorNotification,
} from "../states/notifications";
import * as Skeleton from "../utils/skeleton";
import { isPopupVisible } from "../utils/misc";
import { onDOMReady, qs } from "../utils/dom";

const wrapperId = "videoAdPopupWrapper";

export async function show(): Promise<void> {
  showNoticeNotification("Ads are disabled.", {
    durationMs: 3000,
  });
}

function hide(): void {
  if (isPopupVisible(wrapperId)) {
    const el = qs("#videoAdPopupWrapper");

    el?.animate({
      opacity: [1, 0],
      duration: 125,
      onComplete: () => {
        el.hide();
        Skeleton.remove(wrapperId);
      },
    });
  }
}

export function egVideoListener(options: Record<string, string>): void {
  const event = options["event"];

  if (event === "started") {
    //
  } else if (event === "finished") {
    hide();
  } else if (event === "empty") {
    showErrorNotification("Failed to load video ad. Please try again later", {
      durationMs: 3000,
    });
    hide();
  }
}

qs(".pageTest #watchVideoAdButton")?.on("click", () => {
  void show();
});

onDOMReady(() => {
  Skeleton.save(wrapperId);
});
