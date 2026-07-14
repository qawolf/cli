import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { Command } from "commander";

import { flowsMessages } from "~/core/messages/index.js";
import { createSignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { registerFlowsCommand } from "./index.js";

// `process.exitCode` is global state and persists across tests; reset to 0
// before/after each case so a single test setting it does not bleed into
// other test files (bun's runner reads exitCode at process exit).
beforeEach(() => {
  process.exitCode = 0;
});

afterEach(() => {
  process.exitCode = 0;
  mock.restore();
});

function makeProgram(): Command {
  const program = new Command().name("qawolf").exitOverride();
  registerFlowsCommand(program, createSignalRegistry());
  return program;
}

async function runList(args: string[]): Promise<string> {
  const writes: string[] = [];
  const capture = (chunk: unknown): boolean => {
    writes.push(String(chunk));
    return true;
  };
  spyOn(process.stdout, "write").mockImplementation(capture);
  spyOn(process.stderr, "write").mockImplementation(capture);

  await makeProgram().parseAsync(["flows", "list", ...args], { from: "user" });
  return writes.join("");
}

describe("flows list flag combinations", () => {
  it("rejects --remote without --env", async () => {
    const output = await runList(["--remote"]);

    expect(process.exitCode).toBe(1);
    expect(output).toContain(flowsMessages.list.remoteRequiresEnv);
  });

  it("rejects --env without --remote", async () => {
    const output = await runList(["--env", "staging"]);

    expect(process.exitCode).toBe(1);
    expect(output).toContain(flowsMessages.list.flagsRequireRemote);
  });

  it("rejects --include-drafts without --remote", async () => {
    const output = await runList(["--include-drafts"]);

    expect(process.exitCode).toBe(1);
    expect(output).toContain(flowsMessages.list.flagsRequireRemote);
  });
});
