import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const mockState = vi.hoisted(() => ({ activeWordIndex: 0 }));
vi.mock("../../../src/ts/states/test", () => ({
  getActiveWordIndex: () => mockState.activeWordIndex,
}));

import {
  isIgnoredExtraSpace,
  isSkippedOptionalSpace,
} from "../../../src/ts/input/helpers/optional-spaces";
import { words as TestWords } from "../../../src/ts/test/test-words";
import { __testing } from "../../../src/ts/config/testing";

const { replaceConfig } = __testing;

/** splits `text` into test words, like the words generator does for quotes */
function setText(text: string): void {
  TestWords.reset();
  const words = text.replace(/\n/g, "\n ").split(" ");
  words.forEach((word, index) =>
    TestWords.push(
      index === words.length - 1 || word.endsWith("\n") ? word : `${word} `,
      index,
    ),
  );
}

describe("optional spaces", () => {
  beforeEach(() => {
    mockState.activeWordIndex = 0;
    replaceConfig({
      language: "ariasctl",
      stopOnError: "off",
      deleteOnError: "off",
      difficulty: "normal",
      strictSpace: false,
    });
  });

  afterAll(() => {
    replaceConfig({});
  });

  describe("isIgnoredExtraSpace", () => {
    it("ignores a space between tokens that don't merge", () => {
      setText("a=b;");
      expect(isIgnoredExtraSpace(" ", "a")).toBe(true);
      expect(isIgnoredExtraSpace(" ", "a=")).toBe(true);
    });

    it("ignores a second space", () => {
      setText("a = b;");
      mockState.activeWordIndex = 1;
      expect(isIgnoredExtraSpace(" ", "")).toBe(true);
    });

    it("ignores a space at the end of a line", () => {
      setText("f();\ng();");
      expect(isIgnoredExtraSpace(" ", "f();")).toBe(true);
    });

    it("keeps a space that changes the code", () => {
      setText("intx;");
      expect(isIgnoredExtraSpace(" ", "int")).toBe(false);
      setText('f("ab");');
      expect(isIgnoredExtraSpace(" ", 'f("a')).toBe(false);
    });

    it("keeps the space of the text", () => {
      setText("a = b;");
      expect(isIgnoredExtraSpace(" ", "a")).toBe(false);
    });

    it("keeps spaces after a typo", () => {
      setText("a=b;");
      expect(isIgnoredExtraSpace(" ", "x")).toBe(false);
    });

    it("ignores spaces in handbook-usm", () => {
      replaceConfig({ language: "handbook-usm" });
      setText("a=b;");
      expect(isIgnoredExtraSpace(" ", "a")).toBe(true);
    });

    it("keeps spaces in other languages", () => {
      replaceConfig({ language: "english" });
      setText("a=b;");
      expect(isIgnoredExtraSpace(" ", "a")).toBe(false);
    });
  });

  describe("isSkippedOptionalSpace", () => {
    it("uses the rest of the line for literals", () => {
      setText('f(" = ");');
      // the space after the opening quote is inside the string
      expect(isSkippedOptionalSpace("=", 'f("')).toBe(false);
    });

    it("uses the start of the line for directives", () => {
      setText("#define f (x) x");
      mockState.activeWordIndex = 1;
      // would turn it into a function-like macro
      expect(isSkippedOptionalSpace("(", "f")).toBe(false);

      setText("#define K(x) pii{x}");
      mockState.activeWordIndex = 1;
      expect(isSkippedOptionalSpace("p", "K(x)")).toBe(true);
    });

    it("does not skip a newline", () => {
      setText("f();\ng();");
      expect(isSkippedOptionalSpace("g", "f();")).toBe(false);
    });
  });
});
