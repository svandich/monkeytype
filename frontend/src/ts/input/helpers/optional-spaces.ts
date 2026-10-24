import { Config } from "../../config/store";
import { getActiveWordIndex } from "../../states/test";
import * as TestWords from "../../test/test-words";
import { isCppSpaceOptional } from "../../utils/cpp-spacing";
import { removeLanguageSize } from "../../utils/strings";
import { shouldGoToNextWord } from "./validation";

/**
 * Languages made of C++ code. Spaces in them are only enforced where the code
 * needs them to compile, add new C++ languages here.
 */
const CPP_LANGUAGES = new Set(["ariasctl", "handbook-usm", "code_c++"]);

// how far to look for the start of the line, in words
const MAX_LINE_WORDS = 200;

function hasOptionalSpaces(): boolean {
  return CPP_LANGUAGES.has(removeLanguageSize(Config.language));
}

/** text of the words before `wordIndex` on its line, with their spaces */
function getLineBefore(wordIndex: number): string {
  let text = "";
  for (let i = wordIndex - 1; i >= 0 && i >= wordIndex - MAX_LINE_WORDS; i--) {
    const word = TestWords.words.get(i);
    if (word?.commit !== " ") break;
    text = word.textWithCommit + text;
  }
  return text;
}

/** text of the words after `wordIndex` on its line, with their spaces */
function getLineAfter(wordIndex: number): string {
  if (TestWords.words.get(wordIndex)?.commit !== " ") return "";
  let text = "";
  for (let i = wordIndex + 1; i <= wordIndex + MAX_LINE_WORDS; i++) {
    const word = TestWords.words.get(i);
    if (word === undefined) break;
    text += word.text;
    if (word.commit !== " ") break;
    text += " ";
  }
  return text;
}

/**
 * The user typed the first character of the next word instead of the space
 * that ends the current one, and the code compiles without that space. The
 * space should be inserted for them.
 * @param data - typed character
 * @param testInput - input of the current word so far
 */
export function isSkippedOptionalSpace(
  data: string,
  testInput: string,
): boolean {
  if (!hasOptionalSpaces() || data === " " || data === "\n") return false;

  const wordIndex = getActiveWordIndex();
  const word = TestWords.words.get(wordIndex);
  const nextWord = TestWords.words.get(wordIndex + 1);
  if (
    word === undefined ||
    nextWord === undefined ||
    word.commit !== " " ||
    testInput.length !== word.text.length ||
    !nextWord.text.startsWith(data)
  ) {
    return false;
  }

  return (
    shouldGoToNextWord({
      data: " ",
      inputValue: testInput,
      targetWord: word.textWithCommit,
      commitCharacterType: "separator",
    }) &&
    isCppSpaceOptional(
      getLineBefore(wordIndex) + word.text,
      getLineAfter(wordIndex),
    )
  );
}

/**
 * The user typed a space where the text has none (or one more than the text
 * has), and the code compiles the same with it. The space should be ignored.
 * @param data - typed character
 * @param testInput - input of the current word so far
 */
export function isIgnoredExtraSpace(data: string, testInput: string): boolean {
  if (!hasOptionalSpaces() || data !== " ") return false;

  const wordIndex = getActiveWordIndex();
  const word = TestWords.words.get(wordIndex);
  if (word === undefined) return false;

  const targetChar = word.textWithCommit[testInput.length];
  if (
    targetChar === undefined ||
    targetChar === " " ||
    !word.textWithCommit.startsWith(testInput)
  ) {
    return false;
  }

  const rest =
    word.text.slice(testInput.length) +
    (word.commit === " " ? ` ${getLineAfter(wordIndex)}` : "");
  return isCppSpaceOptional(getLineBefore(wordIndex) + testInput, rest);
}
