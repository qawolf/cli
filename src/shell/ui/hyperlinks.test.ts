import { describe, expect, it } from "bun:test";

import { linkifyUrls, supportsHyperlinks } from "./hyperlinks.js";

const osc8 = "\x1b]8;;";
const bel = "\x07";
const link = (url: string, label = url): string =>
  `${osc8}${url}${bel}${label}${osc8}${bel}`;

describe("linkifyUrls", () => {
  it("wraps a url in an OSC 8 hyperlink", () => {
    const url = "https://app.qawolf.com/team/runs/run-id";
    expect(linkifyUrls(`url: ${url}`)).toBe(`url: ${link(url)}`);
  });

  it("leaves text without a url untouched", () => {
    expect(linkifyUrls("runId: rnzy3jlwsod9opaf")).toBe(
      "runId: rnzy3jlwsod9opaf",
    );
  });

  it("wraps every url on a multi-line message", () => {
    const first = "https://app.qawolf.com/a";
    const second = "http://localhost:3000/b";
    expect(linkifyUrls(`${first}\nthen ${second}`)).toBe(
      `${link(first)}\nthen ${link(second)}`,
    );
  });

  it("keeps trailing sentence punctuation outside the link", () => {
    const url = "https://docs.qawolf.com/cli";
    expect(linkifyUrls(`See ${url}.`)).toBe(`See ${link(url)}.`);
  });

  it("keeps query strings inside the link", () => {
    const url = "https://app.qawolf.com/runs?filter=failed&page=2";
    expect(linkifyUrls(url)).toBe(link(url));
  });
});

describe("supportsHyperlinks", () => {
  it("is false when stdout is not a tty", () => {
    expect(
      supportsHyperlinks({
        env: { TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.5.0" },
        stdoutIsTTY: false,
      }),
    ).toBe(false);
  });

  it("is true for iTerm2 3.1 and newer", () => {
    expect(
      supportsHyperlinks({
        env: { TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.1" },
        stdoutIsTTY: true,
      }),
    ).toBe(true);
  });

  it("is false for iTerm2 older than 3.1", () => {
    expect(
      supportsHyperlinks({
        env: { TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.0.15" },
        stdoutIsTTY: true,
      }),
    ).toBe(false);
  });

  it("is true for VS Code 1.72 and newer", () => {
    expect(
      supportsHyperlinks({
        env: { TERM_PROGRAM: "vscode", TERM_PROGRAM_VERSION: "1.108.0" },
        stdoutIsTTY: true,
      }),
    ).toBe(true);
  });

  it("is false for macOS Terminal", () => {
    expect(
      supportsHyperlinks({
        env: { TERM_PROGRAM: "Apple_Terminal", TERM_PROGRAM_VERSION: "455" },
        stdoutIsTTY: true,
      }),
    ).toBe(false);
  });

  it("is false for an unknown terminal", () => {
    expect(supportsHyperlinks({ env: {}, stdoutIsTTY: true })).toBe(false);
  });

  it("is false for TERM=dumb", () => {
    expect(
      supportsHyperlinks({
        env: { TERM: "dumb", TERM_PROGRAM: "WezTerm" },
        stdoutIsTTY: true,
      }),
    ).toBe(false);
  });

  it("is true for kitty", () => {
    expect(
      supportsHyperlinks({ env: { TERM: "xterm-kitty" }, stdoutIsTTY: true }),
    ).toBe(true);
  });

  it("is true for Windows Terminal", () => {
    expect(
      supportsHyperlinks({ env: { WT_SESSION: "abc" }, stdoutIsTTY: true }),
    ).toBe(true);
  });

  it("is true for VTE 0.50 and newer", () => {
    expect(
      supportsHyperlinks({ env: { VTE_VERSION: "5202" }, stdoutIsTTY: true }),
    ).toBe(true);
  });

  it("is false for VTE older than 0.50", () => {
    expect(
      supportsHyperlinks({ env: { VTE_VERSION: "4600" }, stdoutIsTTY: true }),
    ).toBe(false);
  });

  it("honors FORCE_HYPERLINK even without a tty", () => {
    expect(
      supportsHyperlinks({ env: { FORCE_HYPERLINK: "1" }, stdoutIsTTY: false }),
    ).toBe(true);
  });

  it("honors FORCE_HYPERLINK=0 on a supported terminal", () => {
    expect(
      supportsHyperlinks({
        env: { FORCE_HYPERLINK: "0", TERM: "xterm-kitty" },
        stdoutIsTTY: true,
      }),
    ).toBe(false);
  });
});
