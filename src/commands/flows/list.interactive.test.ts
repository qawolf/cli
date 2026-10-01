import { afterEach, expect, it, mock, spyOn } from "bun:test";
import { Command } from "commander";

import { flowsMessages } from "~/core/messages/index.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

import { registerFlowsListCommand } from "./list.register.js";
import type { withResolvedEnv } from "./withResolvedEnv.js";

afterEach(() => {
  process.exitCode = 0;
  mock.restore();
});

for (const mode of ["--json", "--agent"]) {
  it(`rejects -i ${mode} before remote authentication or environment resolution`, async () => {
    const output: string[] = [];
    const capture = (chunk: unknown): boolean => {
      output.push(String(chunk));
      return true;
    };
    spyOn(process.stdout, "write").mockImplementation(capture);
    spyOn(process.stderr, "write").mockImplementation(capture);
    const resolve = mock<typeof withResolvedEnv>(() => async () => {});
    const program = new Command().option("--json").option("--agent");
    registerFlowsListCommand(program.command("flows"), makeNoopSignals(), {
      withResolvedEnv: resolve,
    });

    await program.parseAsync(
      ["flows", "list", "--remote", "--env", "staging", "-i", mode],
      { from: "user" },
    );

    expect(resolve).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(output.join("")).toContain(
      flowsMessages.list.interactiveRequiresTerminal,
    );
  });
}
