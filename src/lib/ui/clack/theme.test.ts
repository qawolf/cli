import { describe, expect, it } from "bun:test";

import { styledTitle } from "./theme.js";

const qaWolfBlueBg = "\x1b[48;2;59;59;239m";
const whiteBold = "\x1b[97;1m";
const reset = "\x1b[0m";

describe("styledTitle", () => {
  it("contains ANSI blue background escape", () => {
    const result = styledTitle("QA Wolf");
    expect(result).toContain(qaWolfBlueBg);
  });

  it("contains bold white escape", () => {
    const result = styledTitle("QA Wolf");
    expect(result).toContain(whiteBold);
  });

  it("wraps title with spaces", () => {
    const result = styledTitle("QA Wolf");
    expect(result).toContain(" QA Wolf ");
  });

  it("ends with reset sequence", () => {
    const result = styledTitle("QA Wolf");
    expect(result.endsWith(reset)).toBe(true);
  });

  it("empty title still produces correct structure", () => {
    const result = styledTitle("");
    expect(result).toBe(`${qaWolfBlueBg}${whiteBold}  ${reset}`);
  });
});
