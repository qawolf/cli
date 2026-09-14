import { describe, expect, it, mock } from "bun:test";

import { sleep } from "~/core/sleep.js";

import { actionHints, createActionRunner } from "./filterActions.js";
import type { FilterAction, FilterNotice } from "./types.js";

const done = (text: string): Promise<FilterNotice> =>
  Promise.resolve({ tone: "success", text });

const copyPath: FilterAction<string> = {
  key: "y",
  label: "copy path",
  run: (items) => done(`Copied ${items.join(" ")}`),
};

const runner = (actions: FilterAction<string>[] = [copyPath], holdMs = 20) => {
  const changed = mock();
  return { changed, ...createActionRunner({ actions, holdMs, changed }) };
};

describe("createActionRunner", () => {
  it("ignores an action that completes after disposal", async () => {
    const pending = Promise.withResolvers<FilterNotice>();
    const r = runner([{ key: "y", label: "copy", run: () => pending.promise }]);
    r.onKey({ name: "y", ctrl: true }, ["a"]);
    r.dispose();
    pending.resolve({ tone: "success", text: "late" });
    await sleep(30);
    expect(r.changed).not.toHaveBeenCalled();
    expect(r.notice()).toBeUndefined();
  });
  it("runs the action for Ctrl and its key, on the items it is given", async () => {
    const r = runner();

    r.onKey({ name: "y", ctrl: true }, ["src/a.flow.ts", "src/b.flow.ts"]);
    await sleep(1);

    expect(r.notice()).toEqual({
      tone: "success",
      text: "Copied src/a.flow.ts src/b.flow.ts",
    });
    expect(r.changed).toHaveBeenCalled();
    r.dispose();
  });

  it("ignores the letter without Ctrl, since that is typing", async () => {
    const run = mock(() => done("x"));
    const r = runner([{ key: "y", label: "copy", run }]);

    r.onKey({ name: "y", ctrl: false }, ["a"]);
    await sleep(1);

    expect(run).not.toHaveBeenCalled();
    r.dispose();
  });

  it("does nothing when there is nothing to act on", async () => {
    const run = mock(() => done("x"));
    const r = runner([{ key: "y", label: "copy", run }]);

    r.onKey({ name: "y", ctrl: true }, []);
    await sleep(1);

    expect(run).not.toHaveBeenCalled();
    r.dispose();
  });

  it("clears the confirmation after a moment", async () => {
    const r = runner();

    r.onKey({ name: "y", ctrl: true }, ["a"]);
    await sleep(60);

    expect(r.notice()).toBeUndefined();
    r.dispose();
  });

  it("reports a failed action instead of throwing", async () => {
    const r = runner([
      {
        key: "y",
        label: "copy path",
        run: () => Promise.reject(new Error("no")),
      },
    ]);

    r.onKey({ name: "y", ctrl: true }, ["a"]);
    await sleep(1);

    expect(r.notice()).toEqual({
      tone: "warning",
      text: "Could not copy path.",
    });
    r.dispose();
  });
});

describe("actionHints", () => {
  it("names each key with its label", () => {
    expect(
      actionHints([
        copyPath,
        { key: "o", label: "copy id", run: copyPath.run },
      ]),
    ).toBe("^Y copy path · ^O copy id");
  });
});
