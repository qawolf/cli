import type { Command } from "commander";
import { describe, expect, it } from "bun:test";

import { createProgram } from "~/commands/program.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

import { toUploadOptions, type UploadFlags } from "./upload.register.js";

function find(parent: Command, name: string): Command {
  const command = parent.commands.find((child) => child.name() === name);
  if (!command) throw Error(`Missing command ${name}`);
  return command;
}

async function parseUploadOptions(args: string[]) {
  const program = createProgram({ signals: makeNoopSignals() });
  const command = find(find(program, "build"), "upload");
  let parsed: ReturnType<typeof toUploadOptions> | undefined;
  command
    .exitOverride()
    .configureOutput({ writeErr: () => {}, writeOut: () => {} });
  // Capture real Commander option parsing without authenticating.
  command.action((filePath: string, opts: UploadFlags) => {
    parsed = toUploadOptions(filePath, opts);
  });
  await program.parseAsync(["build", "upload", "app.apk", ...args], {
    from: "user",
  });
  return parsed;
}

describe("build upload flags", () => {
  it("passes every flag to the upload", async () => {
    expect(
      await parseUploadOptions([
        "--environment-name",
        "pr-42",
        "--environment-ephemeral",
        "--environment-base-ephemeral-environment",
        "staging",
        "--branch",
        "feat/login",
        "--commit-sha",
        "1a2b3c4",
        "--workspace-id",
        "ws_1",
      ]),
    ).toEqual({
      branch: "feat/login",
      commitSha: "1a2b3c4",
      environmentBaseEphemeralEnvironment: "staging",
      environmentEphemeral: true,
      environmentId: undefined,
      environmentName: "pr-42",
      filePath: "app.apk",
      workspaceId: "ws_1",
    });
  });

  it("passes --environment-id on its own", async () => {
    expect(await parseUploadOptions(["--environment-id", "env_1"])).toEqual({
      branch: undefined,
      commitSha: undefined,
      environmentBaseEphemeralEnvironment: undefined,
      environmentEphemeral: undefined,
      environmentId: "env_1",
      environmentName: undefined,
      filePath: "app.apk",
      workspaceId: undefined,
    });
  });
});
