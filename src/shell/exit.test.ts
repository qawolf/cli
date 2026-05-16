import { describe, expect, it } from "bun:test";

import { exitCodes, exit } from "./exit.js";

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
