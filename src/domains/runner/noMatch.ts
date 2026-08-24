import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

/**
 * Every path that selects zero runnable flows funnels here, so the exit code and
 * the --allow-no-match downgrade stay in one place. `notice` is the message the
 * downgraded run prints, or undefined where the caller already said enough.
 */
export function noMatchResult(
  ctx: CommandContext,
  args: {
    readonly allowNoMatch: boolean;
    readonly error: string;
    readonly notice: string | undefined;
  },
): CommandResult {
  if (!args.allowNoMatch) {
    return { error: args.error, exitCode: exitCodes.invalidArgs };
  }
  if (args.notice !== undefined) ctx.ui.info(args.notice);
  return;
}
