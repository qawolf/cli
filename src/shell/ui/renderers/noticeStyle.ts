import { green, yellow } from "~/core/ansi.js";

import type { FilterNotice } from "./types.js";

export const noticeMark: Record<FilterNotice["tone"], string> = {
  success: "✓",
  warning: "▲",
};
export const noticePaint: Record<
  FilterNotice["tone"],
  (text: string) => string
> = {
  success: green,
  warning: yellow,
};
