import { describe, expect, it } from "bun:test";

import { sleep } from "~/core/sleep.js";

import { fakeTerminal, open, typed, paints } from "./filterList.testUtils.js";

const enterAltScreen = "\x1b[?1049h";
const leaveAltScreen = "\x1b[?1049l";
const frameStart = "\x1b[?2026h";

describe("createFilterList", () => {
  it("keeps what matches the search when Enter is pressed", async () => {
    const terminal = fakeTerminal();
    const { input, result } = open(terminal);

    await typed(input, "be");
    input.write("\r");

    expect(await result).toEqual({ ok: true, value: ["beta"] });
  });

  // Drawn inline, a resize let the terminal rewrap the frame into scrollback.
  it("draws only on the alternate screen, and hands the screen back", async () => {
    const terminal = fakeTerminal();
    const { input, result } = open(terminal);

    await typed(input, "\r");
    await result;

    const out = terminal.writes.join("");
    const entered = out.indexOf(enterAltScreen);
    const left = out.lastIndexOf(leaveAltScreen);
    expect(entered).toBeGreaterThanOrEqual(0);
    expect(left).toBeGreaterThan(entered);
    expect(out.indexOf("alpha")).toBeGreaterThan(entered);
    expect(out.lastIndexOf(frameStart)).toBeLessThan(left);
  });

  it("leaves the search and its match count on the normal screen", async () => {
    const terminal = fakeTerminal();
    const { input, result } = open(terminal);

    await typed(input, "be");
    input.write("\r");
    await result;

    const out = terminal.writes.join("");
    const after = out.slice(out.lastIndexOf(leaveAltScreen));
    expect(after).toContain("be");
    expect(after).toContain("1 of 3");
    expect(after).not.toContain("gamma");
  });

  it("describes the highlighted row", async () => {
    const terminal = fakeTerminal();
    const { input, result } = open(terminal);

    await typed(input, "\x1b[B");

    expect(paints(terminal).at(-1)).toContain("about beta");
    input.write("\x03");
    await result;
  });

  it("repaints once when the window settles at a new size", async () => {
    const terminal = fakeTerminal();
    const { input, result } = open(terminal);
    await sleep(20);
    const before = paints(terminal).length;

    terminal.columns = 40;
    for (let i = 0; i < 5; i += 1) terminal.emit("resize");
    await sleep(200);

    expect(paints(terminal).length).toBe(before + 1);
    input.write("\r");
    await result;
  });

  it("hands the screen back and resolves not ok when cancelled", async () => {
    const terminal = fakeTerminal();
    const { input, result } = open(terminal);

    await typed(input, "\x03");

    expect(await result).toEqual({ ok: false });
    expect(terminal.writes.join("")).toContain(leaveAltScreen);
  });
});
