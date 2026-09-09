import { describe, expect, it } from "bun:test";

import { exitCodes, exit, createSignalExit, exitWhenIdle } from "./exit.js";

function createFakeProcess() {
  const stderr: string[] = [];
  const exitCalls: number[] = [];
  const proc = {
    stderr: {
      write: (chunk: string): boolean => {
        stderr.push(chunk);
        return true;
      },
    },
    exit: (code: number): never => {
      exitCalls.push(code);
      throw new Error("__fake-exit__");
    },
  };
  return { proc, stderr, exitCalls };
}

describe("exit", () => {
  it("calls process.exit with the given code", () => {
    const { proc, exitCalls } = createFakeProcess();
    expect(() => exit(exitCodes.invalidArgs, undefined, proc)).toThrow(
      "__fake-exit__",
    );
    expect(exitCalls).toEqual([2]);
  });

  it("writes the message to stderr when provided", () => {
    const { proc, stderr, exitCalls } = createFakeProcess();
    expect(() =>
      exit(exitCodes.invalidArgs, 'Unknown command "foo"', proc),
    ).toThrow();
    expect(stderr).toEqual(['Unknown command "foo"\n']);
    expect(exitCalls).toEqual([2]);
  });

  it("does not write to stderr when message is omitted", () => {
    const { proc, stderr } = createFakeProcess();
    expect(() => exit(exitCodes.success, undefined, proc)).toThrow();
    expect(stderr).toEqual([]);
  });

  it("does not write to stderr for an empty message", () => {
    const { proc, stderr } = createFakeProcess();
    expect(() => exit(exitCodes.success, "", proc)).toThrow();
    expect(stderr).toEqual([]);
  });

  it("exposes the documented exit codes", () => {
    expect(exitCodes).toEqual({
      success: 0,
      testFailure: 1,
      invalidArgs: 2,
      auth: 3,
      network: 4,
      config: 5,
      timeout: 6,
      payment: 7,
    });
  });
});

function createIdleFakeProcess() {
  const exitCalls: number[] = [];
  const proc = {
    exitCode: undefined as number | string | undefined,
    exit: (code: number): never => {
      exitCalls.push(code);
      throw Error("__fake-exit__");
    },
  };
  return { proc, exitCalls };
}

describe("exitWhenIdle", () => {
  it("records the exit code without killing the process", () => {
    const { proc, exitCalls } = createIdleFakeProcess();
    exitWhenIdle(exitCodes.testFailure, proc, () => {});
    expect(proc.exitCode).toBe(1);
    expect(exitCalls).toEqual([]);
  });

  it("forces the exit from the backstop when the loop stays busy", () => {
    const { proc, exitCalls } = createIdleFakeProcess();
    let backstop: (() => void) | undefined;
    exitWhenIdle(exitCodes.payment, proc, (fn) => {
      backstop = fn;
    });
    expect(exitCalls).toEqual([]);
    expect(() => backstop?.()).toThrow("__fake-exit__");
    expect(exitCalls).toEqual([7]);
  });
});

// Let the shutdown promise's .finally chain run before reading the result.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function createSignalFake() {
  const { proc, exitCalls } = createIdleFakeProcess();
  const shutdownReasons: string[] = [];
  let grace: (() => void) | undefined;
  const onSignal = createSignalExit({
    proc,
    scheduleGrace: (fn) => {
      grace = fn;
    },
    shutdown: (reason) => {
      shutdownReasons.push(reason);
      return Promise.resolve();
    },
  });
  return {
    exitCalls,
    onSignal,
    proc,
    shutdownReasons,
    endGrace: () => grace?.(),
  };
}

describe("createSignalExit", () => {
  it("records the exit code after shutdown without killing the process", async () => {
    const { onSignal, proc, exitCalls } = createSignalFake();
    onSignal("SIGINT")();
    await settle();
    expect(proc.exitCode).toBe(130);
    expect(exitCalls).toEqual([]);
  });

  it("forces the exit when the grace period ends", async () => {
    const { onSignal, exitCalls, endGrace } = createSignalFake();
    onSignal("SIGINT")();
    await settle();
    expect(() => endGrace()).toThrow("__fake-exit__");
    expect(exitCalls).toEqual([130]);
  });

  it("records 143 for SIGTERM", async () => {
    const { onSignal, proc } = createSignalFake();
    onSignal("SIGTERM")();
    await settle();
    expect(proc.exitCode).toBe(143);
  });

  it("shuts down with the signal as the reason", async () => {
    const { onSignal, shutdownReasons } = createSignalFake();
    onSignal("SIGTERM")();
    await settle();
    expect(shutdownReasons).toEqual(["SIGTERM"]);
  });

  it("exits at once on a second signal, without waiting for shutdown", async () => {
    const { onSignal, exitCalls, shutdownReasons } = createSignalFake();
    onSignal("SIGINT")();
    await settle();
    expect(() => onSignal("SIGINT")()).toThrow("__fake-exit__");
    expect(exitCalls).toEqual([130]);
    expect(shutdownReasons).toEqual(["SIGINT"]);
  });

  it("shares the signalled flag across signals", async () => {
    const { onSignal, exitCalls } = createSignalFake();
    onSignal("SIGINT")();
    await settle();
    expect(() => onSignal("SIGTERM")()).toThrow("__fake-exit__");
    expect(exitCalls).toEqual([143]);
  });
});
