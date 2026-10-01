import { describe, expect, it } from "bun:test";

import { displayWidth, padColumns } from "./displayWidth.js";

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

  it("pads by display columns", () => {
    expect(padColumns("登录", 6)).toBe("登录  ");
  });
});
