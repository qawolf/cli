import { EventEmitter } from "node:events";
import { describe, expect, it, mock } from "bun:test";

import { sleep } from "~/core/sleep.js";

import { withDebouncedResize } from "./debouncedResize.js";

/** `later` calls back the way a real terminal does, after the write returns. */
function fakeTerminal(callBack: "now" | "later" = "now") {
  const writes: string[] = [];
  return Object.assign(new EventEmitter(), {
    columns: 100,
    rows: 30,
    isTTY: true,
    writes,
    write(
      chunk: Uint8Array | string,
      callback: (error?: Error | null) => void,
    ) {
      writes.push(String(chunk));
      if (callBack === "now") callback();
      else setImmediate(() => callback());
      return true;
    },
  });
}

const settleMs = 20;

describe("withDebouncedResize", () => {
  it("passes writes straight through to the terminal", async () => {
    const terminal = fakeTerminal();
    const { output, dispose } = withDebouncedResize(terminal, settleMs);

    await new Promise<void>((resolve) =>
      output.write("frame", () => resolve()),
    );

    expect(terminal.writes.join("")).toBe("frame");
    dispose();
  });

  // A write held back until the terminal calls back is overtaken by whatever
  // is written straight to the terminal meanwhile — a command's own output
  // landing above the prompt's summary.
  it("hands each write on at once, even while the terminal has yet to call back", () => {
    const terminal = fakeTerminal("later");
    const { output, dispose } = withDebouncedResize(terminal, settleMs);

    output.write("summary");
    output.write("\n");

    expect(terminal.writes).toEqual(["summary", "\n"]);
    dispose();
  });

  it("reports the terminal's size as it is now, not as it was", () => {
    const terminal = fakeTerminal();
    const { output, dispose } = withDebouncedResize(terminal, settleMs);

    terminal.columns = 70;
    terminal.rows = 18;

    expect(Reflect.get(output, "columns")).toBe(70);
    expect(Reflect.get(output, "rows")).toBe(18);
    dispose();
  });

  // Dragging a window edge fires a resize for every size on the way.
  it("turns a burst of resizes into one, after they stop", async () => {
    const terminal = fakeTerminal();
    const { output, dispose } = withDebouncedResize(terminal, settleMs);
    const resized = mock();
    output.on("resize", resized);

    for (let i = 0; i < 10; i += 1) terminal.emit("resize");
    expect(resized).not.toHaveBeenCalled();
    await sleep(settleMs * 3);

    expect(resized).toHaveBeenCalledTimes(1);
    dispose();
  });

  it("drops a pending resize once disposed", async () => {
    const terminal = fakeTerminal();
    const { output, dispose } = withDebouncedResize(terminal, settleMs);
    const resized = mock();
    output.on("resize", resized);

    terminal.emit("resize");
    dispose();
    terminal.emit("resize");
    await sleep(settleMs * 3);

    expect(resized).not.toHaveBeenCalled();
  });
});
