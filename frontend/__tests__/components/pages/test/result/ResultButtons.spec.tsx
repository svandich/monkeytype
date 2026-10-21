// static json (layouts...) read from disk, the test state module loads some
import "../../../../__harness__/mock-static";
import { render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../../src/ts/test/test-logic", () => ({
  restart: vi.fn(),
  repeatTest: vi.fn(),
}));

import { ResultButtons } from "../../../../../src/ts/components/pages/test/result/ResultButtons";

describe("ResultButtons", () => {
  it("when result page is mounted, resultButtonsPrefocusTarget receives focus", () => {
    const { container } = render(() => <ResultButtons glarses={false} />);

    // the prefocus target has no id - it's the unfocusable-by-tab div first in the component
    const prefocusTarget = container.firstElementChild as HTMLElement;
    expect(prefocusTarget.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(prefocusTarget);
  });
});
