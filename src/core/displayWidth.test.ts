import { describe, expect, it } from "bun:test";
import { stripVTControlCharacters } from "node:util";

import { clipColumns, displayWidth, padColumns } from "./displayWidth.js";

describe("display columns", () => {
  it.each([
    ["plain", 5],
    ["登录", 4],
    ["café", 4],
    ["👩🏽‍💻", 2],
    ["🇬🇧", 2],
    ["☕", 2],
    ["✈️", 2],
    ["\x1b[2m登录\x1b[22m", 4],
  ])("measures %s as %i columns", (text, width) => {
    expect(displayWidth(text)).toBe(width);
  });

  it("clips at grapheme boundaries and preserves ANSI resets", () => {
    const clipped = clipColumns("\x1b[2m登录👩🏽‍💻text\x1b[22m", 6);
    expect(stripVTControlCharacters(clipped)).toBe("登录…");
    expect(clipped).toEndWith("\x1b[22m");
    expect(clipColumns("caféx", 5)).toBe("caféx");
    expect(clipColumns("caféxy", 5)).toBe("café…");
  });

  it("keeps a whole Unicode suffix for paths", () => {
    expect(clipColumns("prefix/登录.ts", 8, true)).toBe("…登录.ts");
  });

  it("preserves ANSI spans across grapheme clusters", () => {
    const clipped = clipColumns("e\x1b[2ḿx👩🏽‍💻\x1b[22m", 3);
    expect(stripVTControlCharacters(clipped)).toBe("éx…");
    expect(clipped).toEndWith("\x1b[22m");
  });

  it("returns nothing for zero available columns and pads by columns", () => {
    expect(clipColumns("abc", 0)).toBe("");
    expect(padColumns("登录", 6)).toBe("登录  ");
  });
});
