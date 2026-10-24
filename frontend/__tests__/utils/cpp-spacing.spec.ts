import { describe, it, expect } from "vitest";
import {
  isCppSpaceOptional,
  tokenizeCppLine,
} from "../../src/ts/utils/cpp-spacing";

/** checks the space right after the "|" in `line` */
function optional(line: string): boolean {
  const [before, after] = line.split("|") as [string, string];
  return isCppSpaceOptional(before, after.replace(/^ /, ""));
}

describe("cpp-spacing", () => {
  describe("tokenizeCppLine", () => {
    it("splits identifiers, numbers and punctuators", () => {
      expect(tokenizeCppLine("\tll res = a->b + 1e-9;")).toEqual([
        "ll",
        "res",
        "=",
        "a",
        "->",
        "b",
        "+",
        "1e-9",
        ";",
      ]);
    });

    it("keeps literals whole", () => {
      expect(tokenizeCppLine(`f("a b", 'c', u8"d e", 5'000'000);`)).toEqual([
        "f",
        "(",
        '"a b"',
        ",",
        "'c'",
        ",",
        'u8"d e"',
        ",",
        "5'000'000",
        ")",
        ";",
      ]);
    });

    it("drops comments", () => {
      expect(tokenizeCppLine("a /* b */ c // d")).toEqual(["a", "c"]);
    });

    it("reads include header names", () => {
      expect(tokenizeCppLine("#include <bits/stdc++.h>")).toEqual([
        "#",
        "include",
        "<bits/stdc++.h>",
      ]);
    });
  });

  describe("isCppSpaceOptional", () => {
    it.each([
      "a| = b",
      "a =| b",
      "return| -1;",
      "if| (x)",
      "for (int i = 0;| i < n; i++)",
      "template| <class T>",
      "vec<int>| v;",
      "x = a| - .5",
      "i++| < n",
      "auto& [x, y]| = p;",
      "#include| <random>",
      "#define K(x)| pii{x}",
      "f(x);| ",
      "| x",
      '"a"| "b"',
    ])("%s is optional", (line) => {
      expect(optional(line)).toBe(true);
    });

    it.each([
      "int| x",
      "return| 0;",
      "const| auto",
      "a -| -b",
      "a +| +b",
      "a &| &b",
      "x -| >y",
      "a <| =b",
      "a /| /b",
      "a /| *p",
      "a <=| >b",
      'f("a| b")',
      "c = '|'",
      'L| "x"',
      "#define X| 5",
      "#define f| (x) x",
      "#include <a| b>",
      "1| .5",
    ])("%s is required", (line) => {
      expect(optional(line)).toBe(false);
    });
  });
});
