import { EventEmitter } from "node:events";
import { describe, expect, it } from "bun:test";

import { confirm } from "./confirm.js";

type FakeStdin = EventEmitter & {
  isTTY?: boolean | undefined;
  resume: () => void;
  pause: () => void;
  paused: boolean;
  resumed: boolean;
};

type FakeStdout = { writes: string[]; write: (chunk: string) => boolean };

function createFakeStdin(isTTY: boolean): FakeStdin {
  const emitter = new EventEmitter() as FakeStdin;
  emitter.isTTY = isTTY;
  emitter.resumed = false;
  emitter.paused = false;
  emitter.resume = () => {
    emitter.resumed = true;
  };
  emitter.pause = () => {
    emitter.paused = true;
  };
  return emitter;
}

function createFakeStdout(): FakeStdout {
  const writes: string[] = [];
  return {
    writes,
    write: (chunk) => {
      writes.push(chunk);
      return true;
    },
  };
}

type RunOverrides = {
  yes?: boolean;
  env?: Record<string, string | undefined>;
};

async function runConfirm(
  isTTY: boolean,
  emit: (stdin: FakeStdin) => void,
  overrides: RunOverrides = {},
): Promise<{ result: boolean; stdin: FakeStdin; stdout: FakeStdout }> {
  const stdin = createFakeStdin(isTTY);
  const stdout = createFakeStdout();
  const promise = confirm("Overwrite?", {
    yes: false,
    stdin,
    stdout,
    env: {},
    ...overrides,
  });
  await Promise.resolve();
  emit(stdin);
  return { result: await promise, stdin, stdout };
}

const noEmit = () => {};
const emitData = (data: string | Buffer) => (s: FakeStdin) =>
  s.emit("data", data);

describe("confirm", () => {
  it("returns true immediately when yes is set, without prompting", async () => {
    const { result, stdout, stdin } = await runConfirm(true, noEmit, {
      yes: true,
    });
    expect(result).toBe(true);
    expect(stdout.writes).toEqual([]);
    expect(stdin.resumed).toBe(false);
  });

  it("returns false on non-TTY stdin without prompting", async () => {
    const { result, stdout, stdin } = await runConfirm(false, noEmit);
    expect(result).toBe(false);
    expect(stdout.writes).toEqual([]);
    expect(stdin.resumed).toBe(false);
  });

  it("returns false on a TTY when CI env vars are set", async () => {
    const { result, stdout } = await runConfirm(true, noEmit, {
      env: { CI: "1" },
    });
    expect(result).toBe(false);
    expect(stdout.writes).toEqual([]);
  });

  it("returns true when the user types 'y'", async () => {
    const { result, stdout, stdin } = await runConfirm(
      true,
      emitData(Buffer.from("y\n")),
    );
    expect(result).toBe(true);
    expect(stdout.writes).toEqual(["Overwrite? [y/N] "]);
    expect(stdin.paused).toBe(true);
  });

  it("accepts 'yes' (case-insensitive) as confirmation", async () => {
    const { result } = await runConfirm(true, emitData("  YES  \n"));
    expect(result).toBe(true);
  });

  it("uses only the first line of a multi-line chunk (paste safety)", async () => {
    const { result } = await runConfirm(true, emitData("y\nextra noise\n"));
    expect(result).toBe(true);
  });

  it("returns false when the user types 'n'", async () => {
    const { result } = await runConfirm(true, emitData("n\n"));
    expect(result).toBe(false);
  });

  it("treats an empty line as a refusal (default no)", async () => {
    const { result } = await runConfirm(true, emitData("\n"));
    expect(result).toBe(false);
  });

  it("returns false when stdin closes without input", async () => {
    const { result } = await runConfirm(true, (s) => s.emit("end"));
    expect(result).toBe(false);
  });

  it("removes its listeners after settling so stdin can be reused", async () => {
    const { stdin } = await runConfirm(true, emitData("y\n"));
    expect(stdin.listenerCount("data")).toBe(0);
    expect(stdin.listenerCount("end")).toBe(0);
  });
});
