import { type Command, InvalidArgumentError, Option } from "commander";

import { withAuthContext } from "~/commands/context.js";
import { makeInteractiveRunnerDeps } from "~/domains/interactiveRunner/deps.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

export const runnerFlagDescription =
  "Runner to target. Defaults to QAWOLF_RUNNER_ID, then this directory's stored runner";

/**
 * `--workspace-id`, declared once on `qawolf runner` so every runner command
 * takes it. A runner lives in one workspace, so a flag on only some runner
 * commands would leave the rest looking for it in the saved one.
 */
export function workspaceIdOption(): Option {
  return new Option(
    "--workspace-id <id>",
    "Workspace to work in for this command only. Defaults to the one 'qawolf auth switch' saved, and is never saved itself",
  ).argParser((value) => {
    const trimmed = value.trim();
    // An empty id would send no workspace at all rather than the saved one.
    if (!trimmed) throw new InvalidArgumentError("Give a workspace id.");
    return trimmed;
  });
}

/**
 * `withAuthContext`, working in the workspace `--workspace-id` named when it
 * was passed. Read through `optsWithGlobals` because the flag belongs to the
 * `runner` group, not to the subcommand.
 */
export function withRunnerContext(
  signals: SignalRegistry,
  fn: (ctx: AuthCommandContext) => Promise<CommandResult>,
  deps: Omit<
    NonNullable<Parameters<typeof withAuthContext>[2]>,
    "workspaceId"
  > = {},
): (opts: unknown, command: Command) => Promise<void> {
  return (opts, command) =>
    withAuthContext(signals, fn, {
      ...deps,
      workspaceId: command.optsWithGlobals<{ workspaceId?: string }>()
        .workspaceId,
    })(opts, command);
}

/** Binds the handlers' machine dependencies to the real process and filesystem. */
export function runnerDeps(
  ctx: AuthCommandContext,
): ReturnType<typeof makeInteractiveRunnerDeps> {
  return makeInteractiveRunnerDeps({
    cwd: process.cwd(),
    env: process.env,
    fs: ctx.fs,
  });
}
