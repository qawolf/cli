import { describe, expect, it } from "bun:test";

import { exitCodes, exit, exitWhenIdle } from "./exit.js";

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
