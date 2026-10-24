import { Language, LanguageSchema } from "@monkeytype/schemas/languages";

export const LanguageList: Language[] = LanguageSchema._def.values;

export const LanguageGroups: Record<string, Language[]> = {
  english: [
    "english",
    "english_1k",
    "english_5k",
    "english_10k",
    "english_25k",
    "english_450k",
    "english_commonly_misspelled",
    "english_contractions",
    "english_doubleletter",
    "english_shakespearean",
    "english_old",
    "english_medical",
    "english_legal",
  ],
  spanish: ["spanish", "spanish_1k", "spanish_10k", "spanish_650k"],
  code: [
    "code_python",
    "code_python_1k",
    "code_python_2k",
    "code_python_5k",
    "code_c",
    "code_c++",
    "code_java",
  ],
  ariasctl: ["ariasctl"],
  "handbook-usm": ["handbook-usm"],
};

export type LanguageGroupName = keyof typeof LanguageGroups;
export const LanguageGroupNames: LanguageGroupName[] = Array.from(
  Object.keys(LanguageGroups),
);

/**
 * Fetches the language group for a given language.
 * @param language The language code.
 * @returns the language group.
 */
export function getGroupForLanguage(
  language: Language,
): LanguageGroupName | undefined {
  return LanguageGroupNames.find((group) => group.includes(language));
}

/**
 * Whether the language is made of code. Code languages auto insert tabs and
 * unindent on backspace.
 * @param language The language code.
 */
export function isCodeLanguage(language: Language): boolean {
  return (
    language.startsWith("code") ||
    language === "ariasctl" ||
    language === "handbook-usm"
  );
}
