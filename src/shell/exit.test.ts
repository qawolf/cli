import { describe, expect, it } from "bun:test";

import { exitCodes, exit, flushAndExit } from "./exit.js";

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
    });
  });
});

function createFlushFakeProcess() {
  const exitCalls: number[] = [];
  let stdoutCb: (() => void) | undefined;
  let stderrCb: (() => void) | undefined;
  const proc = {
    stdout: {
      write: (_chunk: string, cb: () => void): boolean => {
        stdoutCb = cb;
        return true;
      },
    },
    stderr: {
      write: (_chunk: string, cb: () => void): boolean => {
        stderrCb = cb;
        return true;
      },
    },
    exit: (code: number): never => {
      exitCalls.push(code);
      throw Error("__fake-exit__");
    },
  };
  return {
    proc,
    exitCalls,
    flushStdout: () => stdoutCb?.(),
    flushStderr: () => stderrCb?.(),
  };
}

describe("flushAndExit", () => {
  it("exits with the given code once both streams have flushed", () => {
    const { proc, exitCalls, flushStdout, flushStderr } =
      createFlushFakeProcess();
    flushAndExit(exitCodes.testFailure, proc, () => {});
    flushStdout();
    expect(exitCalls).toEqual([]);
    expect(() => flushStderr()).toThrow("__fake-exit__");
    expect(exitCalls).toEqual([1]);
  });

  it("does not exit until both streams have flushed", () => {
    const { proc, exitCalls, flushStdout } = createFlushFakeProcess();
    flushAndExit(exitCodes.success, proc, () => {});
    flushStdout();
    expect(exitCalls).toEqual([]);
  });

  it("forces exit via the backstop when a stream stalls", () => {
    const { proc, exitCalls } = createFlushFakeProcess();
    let backstop: (() => void) | undefined;
    flushAndExit(exitCodes.testFailure, proc, (fn) => {
      backstop = fn;
    });
    expect(exitCalls).toEqual([]);
    expect(() => backstop?.()).toThrow("__fake-exit__");
    expect(exitCalls).toEqual([1]);
  });

  it("exits at most once when flush and backstop both fire", () => {
    const { proc, exitCalls, flushStdout, flushStderr } =
      createFlushFakeProcess();
    let backstop: (() => void) | undefined;
    flushAndExit(exitCodes.testFailure, proc, (fn) => {
      backstop = fn;
    });
    flushStdout();
    expect(() => flushStderr()).toThrow("__fake-exit__");
    backstop?.();
    expect(exitCalls).toEqual([1]);
  });
});
