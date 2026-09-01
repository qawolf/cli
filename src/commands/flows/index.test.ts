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

  // --env without --remote names a pulled environment rather than a platform
  // one, so it is answered from disk. This repo has nothing pulled.
  it("accepts --env without --remote and answers it locally", async () => {
    const output = await runList(["--env", "staging"]);

    expect(process.exitCode).toBe(2);
    expect(output).toContain("No pulled environment named 'staging'");
  });

  it("rejects --include-drafts without --remote", async () => {
    const output = await runList(["--include-drafts"]);

    expect(process.exitCode).toBe(1);
    expect(output).toContain(flowsMessages.list.draftsRequireRemote);
  });

  // --tag works without --remote by reading the pull cache. This repo has no
  // pulled env, so it reports that rather than silently matching nothing.
  it("accepts --tag without --remote and reports when no tags are cached", async () => {
    const output = await runList(["--tag", "auth"]);

    expect(process.exitCode).toBe(4);
    expect(output).toContain(flowsMessages.selectors.tagsNotCached);
  });
});

describe("flows list --tag parsing", () => {
  // A variadic --tag swallowed a following positional as another tag name,
  // silently ignoring the pattern. Repeating the flag removes the ambiguity.
  it("leaves a positional pattern alone when it follows --tag", async () => {
    const output = await runList(["--tag", "auth", "src/flows/**"]);

    expect(output).not.toContain("src/flows/**");
  });
});
