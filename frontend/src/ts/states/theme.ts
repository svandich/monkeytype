import { createSignal } from "solid-js";
import { ColorName, Theme } from "../constants/themes";
import { ThemeName } from "@monkeytype/schemas/configs";

export type ThemeIdentifier = ThemeName | "custom";
const defaultTheme: Theme & { name: ThemeIdentifier } = {
  name: "progcompea",
  bg: "#1a122a",
  main: "#a78bfa",
  caret: "#a3e635",
  sub: "#7c6a9c",
  subAlt: "#221733",
  text: "#ede9fe",
  error: "#f87171",
  errorExtra: "#b91c1c",
  colorfulError: "#f87171",
  colorfulErrorExtra: "#b91c1c",
};

export const [getTheme, setTheme] = createSignal(defaultTheme);

export function updateThemeColor(key: ColorName, color: string): void {
  setTheme((prev) => ({
    ...prev,
    [key]: color,
  }));
}
