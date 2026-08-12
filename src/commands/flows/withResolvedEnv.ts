import type { Command } from "commander";

import { withAuthContext, withContext } from "~/commands/context.js";
import { environmentsMessages } from "~/core/messages/index.js";
import { resolveEnvironment } from "~/domains/environments/resolveEnvironment.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";
import { detectOutputMode, type OutputFlags } from "~/shell/ui/env.js";

type Args = {
  // The --env flag value for this invocation.
  explicit: string | undefined;
  // Command-specific "an environment is required" text.
  requiredMessage: string;
};

/**
 * Wraps a platform command action with environment resolution: --env flag,
 * then QAWOLF_ENVIRONMENT, then the interactive picker.
 */
export function withResolvedEnv(
  signals: SignalRegistry,
  args: Args,
  fn: (ctx: AuthCommandContext, env: string) => Promise<CommandResult>,
): (opts: unknown, command: Command) => Promise<void> {
  return (opts, command) => {
    // The picker is the only resolution path that needs the platform. A
    // missing env in a non-interactive mode is a usage error and must not
    // require auth (or a slow keyring read) to report, so it short-circuits
    // before withAuthContext. Mode detection mirrors buildBaseContext.
    const pickerNeeded =
      !args.explicit?.trim() &&
      !(process.env["QAWOLF_ENVIRONMENT"] ?? "").trim();
    if (pickerNeeded) {
      const mode = detectOutputMode({
        flags: command.optsWithGlobals<OutputFlags>(),
        env: process.env,
        stdoutIsTTY: Boolean(process.stdout.isTTY),
      });
      if (mode !== "human") {
        return withContext(signals, async () => ({
          error: args.requiredMessage,
        }))(opts, command);
      }
    }
    return withAuthContext(signals, async (ctx) => {
      const outcome = await resolveEnvironment(
        { platformClient: ctx.platformClient, ui: ctx.ui, env: process.env },
        { explicit: args.explicit, requiredMessage: args.requiredMessage },
      );
      if (outcome.kind === "cancelled") {
        ctx.ui.info(environmentsMessages.aborted);
        return;
      }
      if (outcome.kind === "error") {
        return failureFields(outcome);
      }
      return fn(ctx, outcome.env);
    })(opts, command);
  };
}
