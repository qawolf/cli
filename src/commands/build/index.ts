import type { Command } from "commander";

import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { registerBuildUploadCommand } from "./upload.register.js";

/**
 * Registers the `build` group with its hand-written `upload`. The generated
 * `build.*` commands join this group afterwards.
 */
export function registerBuildCommand(
  program: Command,
  signals: SignalRegistry,
): void {
  const build = program
    .command("build")
    .description("Upload app builds and manage the builds runs install");

  registerBuildUploadCommand(build, signals);
}
