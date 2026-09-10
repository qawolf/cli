import { describe, expect, it } from "bun:test";

import { appendSentence } from "./sentences.js";

describe("appendSentence", () => {
  // The case that shipped a run-on: the platform's reason ends without a stop.
  it("punctuates a sentence that has no terminator", () => {
    expect(appendSentence("the click hit nothing", "Look at the screen.")).toBe(
      "the click hit nothing. Look at the screen.",
    );
  });

  it("leaves an already terminated sentence alone", () => {
    for (const end of [".", "!", "?"]) {
      expect(appendSentence(`done${end}`, "Next.")).toBe(`done${end} Next.`);
    }
  });

  it("does not leave a gap when the first sentence has trailing space", () => {
    expect(appendSentence("done. ", "Next.")).toBe("done. Next.");
  });
});
