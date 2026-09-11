import { describe, expect, it } from "bun:test";

import { wrapText } from "./wrapText.js";

describe("wrapText", () => {
  it("leaves text that fits alone, line breaks and all", () => {
    expect(wrapText("One.\n\nTwo.", 40)).toBe("One.\n\nTwo.");
  });

  it("breaks at spaces so no line runs past the width", () => {
    const wrapped = wrapText("the quick brown fox jumps over the lazy dog", 15);

    expect(wrapped.split("\n")).toEqual([
      "the quick brown",
      "fox jumps over",
      "the lazy dog",
    ]);
  });

  it("keeps a word longer than the width whole", () => {
    const wrapped = wrapText(
      "see https://example.com/a/very/long/path now",
      12,
    );

    expect(wrapped.split("\n")).toEqual([
      "see",
      "https://example.com/a/very/long/path",
      "now",
    ]);
  });

  it("does not turn a trailing space into an empty line", () => {
    expect(wrapText("aaaa bbbb ", 9)).toBe("aaaa bbbb");
  });

  it("carries a line's indent onto the lines it wraps to", () => {
    const wrapped = wrapText("  - alpha beta gamma delta", 14);

    expect(wrapped.split("\n")).toEqual(["  - alpha beta", "  gamma delta"]);
  });
});
