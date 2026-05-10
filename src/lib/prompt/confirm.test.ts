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

function createFakeStdout() {
  const writes: string[] = [];
  return {
    writes,
    write: (chunk: string) => {
      writes.push(chunk);
      return true;
    },
  };
}

describe("confirm", () => {
  it("returns true immediately when yes is set, without prompting", async () => {
    const stdin = createFakeStdin(true);
    const stdout = createFakeStdout();

    const result = await confirm("Overwrite?", { yes: true, stdin, stdout });

    expect(result).toBe(true);
    expect(stdout.writes).toEqual([]);
    expect(stdin.resumed).toBe(false);
  });

  it("returns false on non-TTY stdin without prompting", async () => {
    const stdin = createFakeStdin(false);
    const stdout = createFakeStdout();

    const result = await confirm("Overwrite?", { yes: false, stdin, stdout });

    expect(result).toBe(false);
    expect(stdout.writes).toEqual([]);
    expect(stdin.resumed).toBe(false);
  });

  it("returns true when the user types 'y'", async () => {
    const stdin = createFakeStdin(true);
    const stdout = createFakeStdout();

    const promise = confirm("Overwrite?", { yes: false, stdin, stdout });
    await Promise.resolve();
    stdin.emit("data", Buffer.from("y\n"));

    expect(await promise).toBe(true);
    expect(stdout.writes).toEqual(["Overwrite? [y/N] "]);
    expect(stdin.paused).toBe(true);
  });

  it("accepts 'yes' (case-insensitive) as confirmation", async () => {
    const stdin = createFakeStdin(true);
    const stdout = createFakeStdout();

    const promise = confirm("Overwrite?", { yes: false, stdin, stdout });
    await Promise.resolve();
    stdin.emit("data", "  YES  \n");

    expect(await promise).toBe(true);
  });

  it("returns false when the user types 'n'", async () => {
    const stdin = createFakeStdin(true);
    const stdout = createFakeStdout();

    const promise = confirm("Overwrite?", { yes: false, stdin, stdout });
    await Promise.resolve();
    stdin.emit("data", "n\n");

    expect(await promise).toBe(false);
  });

  it("treats an empty line as a refusal (default no)", async () => {
    const stdin = createFakeStdin(true);
    const stdout = createFakeStdout();

    const promise = confirm("Overwrite?", { yes: false, stdin, stdout });
    await Promise.resolve();
    stdin.emit("data", "\n");

    expect(await promise).toBe(false);
  });

  it("returns false when stdin closes without input", async () => {
    const stdin = createFakeStdin(true);
    const stdout = createFakeStdout();

    const promise = confirm("Overwrite?", { yes: false, stdin, stdout });
    await Promise.resolve();
    stdin.emit("end");

    expect(await promise).toBe(false);
  });

  it("removes its listeners after settling so stdin can be reused", async () => {
    const stdin = createFakeStdin(true);
    const stdout = createFakeStdout();

    const promise = confirm("Overwrite?", { yes: false, stdin, stdout });
    await Promise.resolve();
    stdin.emit("data", "y\n");
    await promise;

    expect(stdin.listenerCount("data")).toBe(0);
    expect(stdin.listenerCount("end")).toBe(0);
  });
});
