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
    const started = Promise.withResolvers<void>();
    const r = runner([
      {
        key: "y",
        label: "copy",
        run: () => {
          started.resolve();
          return pending.promise;
        },
      },
    ]);
    r.onKey({ name: "y", ctrl: true }, ["a"]);
    await started.promise;
    r.dispose();
    pending.resolve({ tone: "success", text: "late" });
    await new Promise<void>((resolve) => setImmediate(resolve));
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
  it("keeps overlapping actions in key-press order", async () => {
    const first = Promise.withResolvers<FilterNotice>();
    const second = Promise.withResolvers<FilterNotice>();
    const started: string[] = [];
    const writes: string[] = [];
    const run = async (items: readonly string[]): Promise<FilterNotice> => {
      const value = items[0] ?? "";
      started.push(value);
      const notice = await (value === "first" ? first : second).promise;
      writes.push(value);
      return notice;
    };
    const r = runner(
      [
        { key: "y", label: "copy path", run },
        { key: "o", label: "copy id", run },
      ],
      1000,
    );
    try {
      r.onKey({ name: "y", ctrl: true }, ["first"]);
      r.onKey({ name: "o", ctrl: true }, ["second"]);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(started).toEqual(["first"]);
      second.resolve({ tone: "success", text: "second" });
      first.resolve({ tone: "success", text: "first" });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(writes).toEqual(["first", "second"]);
      expect(r.notice()?.text).toBe("second");
    } finally {
      r.dispose();
      first.resolve({ tone: "success", text: "first" });
      second.resolve({ tone: "success", text: "second" });
    }
  });

  it("does not start queued or new actions after disposal", async () => {
    const pending = Promise.withResolvers<FilterNotice>();
    const run = mock(() => pending.promise);
    const r = runner([{ key: "y", label: "copy", run }]);
    r.onKey({ name: "y", ctrl: true }, ["first"]);
    await new Promise<void>((resolve) => setImmediate(resolve));
    r.onKey({ name: "y", ctrl: true }, ["second"]);
    r.dispose();
    r.onKey({ name: "y", ctrl: true }, ["third"]);
    pending.resolve({ tone: "success", text: "first" });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(["first"]);
    expect(r.changed).not.toHaveBeenCalled();
    expect(r.notice()).toBeUndefined();
  });

  for (const failure of ["throw", "reject"]) {
    it(`continues queued actions after ${failure}`, async () => {
      const run = (items: readonly string[]): Promise<FilterNotice> => {
        if (items[0] !== "first") return done("second");
        if (failure === "throw") throw new Error("copy failed");
        return Promise.reject(new Error("copy failed"));
      };
      const r = runner([{ key: "y", label: "copy", run }], 1000);
      try {
        r.onKey({ name: "y", ctrl: true }, ["first"]);
        r.onKey({ name: "y", ctrl: true }, ["second"]);
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(r.notice()).toEqual({ tone: "success", text: "second" });
        expect(r.changed).toHaveBeenCalledTimes(2);
      } finally {
        r.dispose();
      }
    });
  }
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
