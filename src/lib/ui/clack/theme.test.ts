import { describe, expect, it } from "vitest";

import { styledTitle } from "./theme.js";

const QA_WOLF_BLUE_BG = "\x1b[48;2;59;59;239m";
const WHITE_BOLD = "\x1b[97;1m";
const RESET = "\x1b[0m";

describe("styledTitle", () => {
  it("contains ANSI blue background escape", () => {
    const result = styledTitle("QA Wolf");
    expect(result).toContain(QA_WOLF_BLUE_BG);
  });

  it("contains bold white escape", () => {
    const result = styledTitle("QA Wolf");
    expect(result).toContain(WHITE_BOLD);
  });

  it("wraps title with spaces", () => {
    const result = styledTitle("QA Wolf");
    expect(result).toContain(" QA Wolf ");
  });

  it("ends with reset sequence", () => {
    const result = styledTitle("QA Wolf");
    expect(result.endsWith(RESET)).toBe(true);
  });

  it("empty title still produces correct structure", () => {
    const result = styledTitle("");
    expect(result).toBe(`${QA_WOLF_BLUE_BG}${WHITE_BOLD}  ${RESET}`);
  });
});
