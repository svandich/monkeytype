import { z } from "zod";
import { KnownFontNameSchema } from "./fonts";
import { customEnumErrorHandler } from "./util";

export const LanguageSchema = z.enum(
  [
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
    "spanish",
    "spanish_1k",
    "spanish_10k",
    "spanish_650k",
    "code_python",
    "code_python_1k",
    "code_python_2k",
    "code_python_5k",
    "code_c",
    "code_c++",
    "code_java",
    "english_legal",
    "ariasctl",
  ],
  {
    errorMap: customEnumErrorHandler("Must be a supported language"),
  },
);

export type Language = z.infer<typeof LanguageSchema>;

export const LanguageObjectSchema = z
  .object({
    name: LanguageSchema,
    rightToLeft: z.boolean().optional(),
    noLazyMode: z.boolean().optional(),
    joiningScript: z.boolean().optional(),
    orderedByFrequency: z.boolean().optional(),
    words: z.array(z.string()).min(1),
    additionalAccents: z
      .array(z.tuple([z.string().min(1), z.string().min(1)]))
      .optional(),
    bcp47: z.string().optional(),
    preferredFont: KnownFontNameSchema.optional(),
    originalPunctuation: z.boolean().optional(),
  })
  .strict();
export type LanguageObject = z.infer<typeof LanguageObjectSchema>;
