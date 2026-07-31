import { describe, expect, it } from "bun:test";

import { splitReleaseNotes, toMrkdwn } from "./slackMrkdwn.js";

describe("toMrkdwn", () => {
  it("converts bold, links, and wide-indent bullets", () => {
    const markdown = "-   **bold** fix ([#12](https://example.com/12))";
    expect(toMrkdwn(markdown)).toBe(
      "• *bold* fix (<https://example.com/12|#12>)",
    );
  });

  it("escapes mrkdwn control characters", () => {
    expect(toMrkdwn("a < b & b > c")).toBe("a &lt; b &amp; b &gt; c");
  });

  it("strips changeset commit-hash prefixes from bullets", () => {
    expect(toMrkdwn("-   4a0ac77: expand the command surface")).toBe(
      "• expand the command surface",
    );
  });

  it("dedents continuation paragraphs but keeps sub-bullet indent", () => {
    const markdown =
      "-   abc1234: first line\n\n    continuation paragraph\n    - sub-bullet";
    expect(toMrkdwn(markdown)).toBe(
      "• first line\n\ncontinuation paragraph\n    • sub-bullet",
    );
  });
});

describe("splitReleaseNotes", () => {
  it("splits change groups and applies emoji titles", () => {
    const body =
      "### Minor Changes\n\n- abc1234: add a flag\n\n### Patch Changes\n\n- def5678: fix a bug";
    expect(splitReleaseNotes(body)).toEqual([
      { title: "✨ Minor changes", text: "• add a flag" },
      { title: "🩹 Patch changes", text: "• fix a bug" },
    ]);
  });

  it("keeps unknown headings and untitled preambles", () => {
    expect(splitReleaseNotes("intro\n\n### Notes\n\ndetails")).toEqual([
      { title: undefined, text: "intro" },
      { title: "Notes", text: "details" },
    ]);
  });

  it("returns no groups for an empty body", () => {
    expect(splitReleaseNotes("")).toEqual([]);
  });
});
