import { describe, expect, it, mock } from "bun:test";
import { PassThrough } from "node:stream";

import { sleep } from "~/core/sleep.js";

import { createFilterList } from "./filterList.js";
import { fakeTerminal, open, typed, paints } from "./filterList.testUtils.js";
import type { FilterNotice } from "./types.js";

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
    const frame = out.indexOf(frameStart, entered);
    const alpha = out.indexOf("alpha", frame);
    expect(frame).toBeGreaterThan(entered);
    expect(frame).toBeLessThan(left);
    expect(alpha).toBeGreaterThan(frame);
    expect(alpha).toBeLessThan(left);
    expect(out.lastIndexOf(frameStart)).toBeLessThan(left);
  });

  it("removes its resize listener when search setup fails", async () => {
    const terminal = fakeTerminal();
    const existingListener = () => {};
    terminal.on("resize", existingListener);
    const failure = new Error("search setup failed");
    const filter = createFilterList({
      mode: "human",
      input: new PassThrough(),
      output: terminal,
    });
    let caught: unknown;
    try {
      await filter({
        message: "Filter things",
        items: ["alpha"],
        searchText: () => {
          throw failure;
        },
        table: () => ({ header: "name", line: (item) => item }),
        describeCount: () => "1 of 1",
        detail: (item) => item,
        actions: [],
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(failure);
    expect(terminal.listeners("resize")).toEqual([existingListener]);
    expect(terminal.writes).toEqual([]);
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

  it("runs an action on the highlighted row and shows its confirmation", async () => {
    const terminal = fakeTerminal();
    const run = mock((items: readonly string[]) =>
      Promise.resolve<FilterNotice>({
        tone: "success",
        text: `Copied ${items.join(" ")}`,
      }),
    );
    const { input, result } = open(terminal, [
      { key: "y", label: "copy", run },
    ]);

    await typed(input, "\x1b[B"); // ↓ moves the highlight to "beta"
    await typed(input, "\x19"); // Ctrl-Y

    expect(run).toHaveBeenCalledWith(["beta"]);
    expect(paints(terminal).at(-1)).toContain("Copied beta");
    input.write("\x03");
    await result;
  });

  it("marks rows with Tab, moving down, and keeps the marked on Enter", async () => {
    const terminal = fakeTerminal();
    const { input, result } = open(terminal);

    await typed(input, "\t"); // marks alpha, moves to beta
    await typed(input, "\x1b[B"); // on to gamma
    await typed(input, "\t");
    input.write("\r");

    expect(await result).toEqual({ ok: true, value: ["alpha", "gamma"] });
  });

  // Tab is the mark key, so it must not end up in the search.
  it("does not type Tab into the search", async () => {
    const terminal = fakeTerminal();
    const { input, result } = open(terminal);

    await typed(input, "a\t");

    expect(paints(terminal).at(-1)).toContain("Search: a█");
    input.write("\x03");
    await result;
  });

  it("keeps marks across searches, in list order", async () => {
    const terminal = fakeTerminal();
    const { input, result } = open(terminal);

    await typed(input, "gam");
    await typed(input, "\t");
    await typed(input, "\x7f\x7f\x7fal");
    await typed(input, "\t");
    input.write("\r");

    expect(await result).toEqual({ ok: true, value: ["alpha", "gamma"] });
  });

  it("runs an action on the marked rows when there are any", async () => {
    const terminal = fakeTerminal();
    const run = mock(() =>
      Promise.resolve<FilterNotice>({ tone: "success", text: "done" }),
    );
    const { input, result } = open(terminal, [
      { key: "y", label: "copy", run },
    ]);

    await typed(input, "\t\t"); // alpha, then beta
    await typed(input, "\x19"); // Ctrl-Y

    expect(run).toHaveBeenCalledWith(["alpha", "beta"]);
    input.write("\x03");
    await result;
  });

  // clack's cursor wraps, so moving on from the last row would jump to the top.
  it("stays on the last row when Tab marks it", async () => {
    const terminal = fakeTerminal();
    const { input, result } = open(terminal);

    await typed(input, "\x1b[B\x1b[B"); // gamma, the last
    await typed(input, "\t");

    expect(paints(terminal).at(-1)).toContain("about gamma");
    input.write("\x03");
    await result;
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
