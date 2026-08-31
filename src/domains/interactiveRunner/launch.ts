import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { launchAndRemember } from "./launchAndRemember.js";
import { parseRunnerId, parseRunnerName } from "./runnerIds.js";

export async function handleRunnerLaunch(
  ctx: AuthCommandContext,
  options: { id: string | undefined; name: string | undefined },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const chosenId = options.id ?? deps.makeRunnerId();
  const id = parseRunnerId(chosenId);
  if (!id.ok) return { error: id.error, exitCode: exitCodes.invalidArgs };

  const runnerName =
    options.name === undefined ? undefined : parseRunnerName(options.name);
  if (runnerName !== undefined && !runnerName.ok) {
    return { error: runnerName.error, exitCode: exitCodes.invalidArgs };
  }

  // Also this directory's default, so the commands that follow need no
  // --runner. Set even when the runner turns out to have been running already:
  // the caller has just named which runner this directory means.
  const launched = await launchAndRemember(
    ctx,
    { id: id.id, runnerName: runnerName?.runnerName },
    deps,
  );
  if (!launched.ok) {
    return { ...failureFields(launched), exitCode: launched.exitCode };
  }

  ctx.ui.output(
    launched.value,
    launched.value.alreadyRunning
      ? interactiveRunnerMessages.alreadyRunning(launched.value.id)
      : interactiveRunnerMessages.launched(launched.value.id),
  );
  return undefined;
}
