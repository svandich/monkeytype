import { LayoutObject } from "@monkeytype/schemas/layouts";
import {
  Keycode,
  leftSideKeys,
  qwertyKeycodeKeymap,
  rightSideKeys,
} from "../constants/keys";

/**
 * Converts a key to a keycode based on a layout
 * @param key Key to convert (e.g., "a")
 * @param layout Layout object from our JSON data (e.g., `layouts["qwerty"]`)
 * @returns Keycode location of the key (e.g., "KeyA")
 */
export function layoutKeyToKeycode(
  key: string,
  layout: LayoutObject,
): Keycode | undefined {
  const rows: string[][][] = Object.values(layout.keys);

  const rowIndex = rows.findIndex((row) => row.find((k) => k.includes(key)));
  const row = rows[rowIndex];
  if (row === undefined) {
    return;
  }

  const keyIndex = row.findIndex((k) => k.includes(key));
  if (keyIndex === -1) {
    return;
  }

  let keycode = qwertyKeycodeKeymap[rowIndex]?.[keyIndex];
  if (layout.type === "iso") {
    if (rowIndex === 2 && keyIndex === 11) {
      keycode = "Backslash";
    } else if (rowIndex === 3 && keyIndex === 0) {
      keycode = "IntlBackslash";
    } else if (rowIndex === 3) {
      keycode = qwertyKeycodeKeymap[3]?.[keyIndex - 1];
    }
  }

  return keycode;
}

/**
 * Converts a keycode to a keyboard side. Can return true for both sides if the key is in the location KeyY, KeyB or Space.
 * @param keycode Keycode to convert (e.g., "KeyA")
 * @returns Object with leftSide and rightSide booleans
 */
export function keycodeToKeyboardSide(keycode: Keycode): {
  leftSide: boolean;
  rightSide: boolean;
} {
  const left = leftSideKeys.has(keycode);
  const right = rightSideKeys.has(keycode);

  return { leftSide: left, rightSide: right };
}
