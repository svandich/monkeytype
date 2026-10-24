// Punctuators that are longer than one character, longest first so the
// tokenizer can do maximal munch. Includes the digraphs and the comment
// openers, a space between "/" and "/" or "*" keeps them from becoming one.
const PUNCTUATORS = [
  "%:%:",
  "<=>",
  "<<=",
  ">>=",
  "->*",
  "...",
  "::",
  "->",
  "++",
  "--",
  "<<",
  ">>",
  "<=",
  ">=",
  "==",
  "!=",
  "&&",
  "||",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  ".*",
  "##",
  "<:",
  ":>",
  "<%",
  "%>",
  "%:",
];

/** marks `#define NAME(` (function-like macro), which a space before the "(" would change */
const FUNCTION_LIKE_MACRO = "\u0000(";

const LITERAL_PREFIX = /^(u8|u|U|L)?R?$/;

function isWhitespace(char: string | undefined): boolean {
  return char === " " || char === "\t" || char === "\v" || char === "\f";
}

function isIdentifierChar(char: string | undefined): boolean {
  if (char === undefined) return false;
  return /[A-Za-z0-9_$]/.test(char) || char.charCodeAt(0) > 127;
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

/**
 * Splits one line of C++ into preprocessing tokens. Comments and whitespace
 * are dropped.
 */
export function tokenizeCppLine(line: string): string[] {
  const tokens: string[] = [];
  const directive = /^\s*(?:#|%:)\s*([A-Za-z_]+)/.exec(line)?.[1];
  const length = line.length;
  let i = 0;

  // end of a string or char literal starting with the quote at `quoteIndex`,
  // including a user-defined suffix
  const literalEnd = (quoteIndex: number, raw: boolean): number => {
    const quote = line[quoteIndex] as string;
    let j = quoteIndex + 1;
    if (raw) {
      const open = line.indexOf("(", j);
      const delimiter = open === -1 ? "" : line.slice(j, open);
      const close = open === -1 ? -1 : line.indexOf(`)${delimiter}"`, open);
      j = close === -1 ? length : close + delimiter.length + 2;
    } else {
      while (j < length && line[j] !== quote) {
        j += line[j] === "\\" ? 2 : 1;
      }
      j = Math.min(j + 1, length);
    }
    while (isIdentifierChar(line[j])) j++;
    return j;
  };

  while (i < length) {
    const char = line[i] as string;

    if (isWhitespace(char)) {
      i++;
      continue;
    }

    if (line.startsWith("//", i)) break;

    if (line.startsWith("/*", i)) {
      const end = line.indexOf("*/", i + 2);
      i = end === -1 ? length : end + 2;
      continue;
    }

    // #include <header name>
    if (directive === "include" && tokens.length === 2 && char === "<") {
      const end = line.indexOf(">", i);
      const next = end === -1 ? length : end + 1;
      tokens.push(line.slice(i, next));
      i = next;
      continue;
    }

    if (isIdentifierChar(char) && !isDigit(char)) {
      let j = i;
      while (isIdentifierChar(line[j])) j++;
      const word = line.slice(i, j);
      const next = line[j];

      if ((next === '"' || next === "'") && LITERAL_PREFIX.test(word)) {
        const end = literalEnd(j, next === '"' && word.endsWith("R"));
        tokens.push(line.slice(i, end));
        i = end;
        continue;
      }

      tokens.push(word);
      if (directive === "define" && tokens.length === 3 && next === "(") {
        tokens.push(FUNCTION_LIKE_MACRO);
      }
      i = j;
      continue;
    }

    // pp-number, includes digit separators and exponents like 1e-9
    if (isDigit(char) || (char === "." && isDigit(line[i + 1]))) {
      let j = i + 1;
      while (j < length) {
        const current = line[j] as string;
        const following = line[j + 1];
        if (
          /[eEpP]/.test(current) &&
          (following === "+" || following === "-")
        ) {
          j += 2;
        } else if (/[0-9A-Za-z_.]/.test(current)) {
          j++;
        } else if (current === "'" && isIdentifierChar(following)) {
          j += 2;
        } else {
          break;
        }
      }
      tokens.push(line.slice(i, j));
      i = j;
      continue;
    }

    if (char === '"' || char === "'") {
      const end = literalEnd(i, false);
      tokens.push(line.slice(i, end));
      i = end;
      continue;
    }

    // <:: is not the <: digraph unless followed by : or >
    if (
      line.startsWith("<::", i) &&
      line[i + 3] !== ":" &&
      line[i + 3] !== ">"
    ) {
      tokens.push("<");
      i++;
      continue;
    }

    const punctuator = PUNCTUATORS.find((it) => line.startsWith(it, i)) ?? char;
    tokens.push(punctuator);
    i += punctuator.length;
  }

  return tokens;
}

/**
 * Whether a space between `before` and `after` (the rest of the line on each
 * side) can be left out without changing how the line compiles, that is
 * without changing its tokens.
 */
export function isCppSpaceOptional(before: string, after: string): boolean {
  const withSpace = tokenizeCppLine(`${before} ${after}`);
  const withoutSpace = tokenizeCppLine(before + after);
  return (
    withSpace.length === withoutSpace.length &&
    withSpace.every((token, index) => token === withoutSpace[index])
  );
}
