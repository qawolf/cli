import { displayWidth } from "./displayWidth.js";

// Each style ends with its own reset rather than a full one (`\x1b[0m`), so a
// style inside another — a dimmed cell in a highlighted row — does not switch
// the outer one off.
export const bold = (text: string): string => `\x1b[1m${text}\x1b[22m`;
export const dim = (text: string): string => `\x1b[2m${text}\x1b[22m`;
export const strike = (text: string): string => `\x1b[9m${text}\x1b[29m`;
export const inverse = (text: string): string => `\x1b[7m${text}\x1b[27m`;
export const cyan = (text: string): string => `\x1b[36m${text}\x1b[39m`;

export const visibleLength = displayWidth;
