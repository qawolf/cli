import { parseFollowTimeout } from "~/core/interactiveRunner/followTimeout.js";
import { toCollectedPath } from "~/core/interactiveRunner/runFiles.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { resolveRecorderAnchor } from "./followPrinters.js";
import { followRun } from "./followRun.js";
import { announceRunner, resolveRunner } from "./resolveRunner.js";
import { prepareRun } from "./prepareRun.js";
import { submitRun } from "./submitRun.js";

export async function handleRunnerRun(
  ctx: AuthCommandContext,
  options: {
    entryPoint: string;
    envFile: string | undefined;
    envId: string | undefined;
    follow: boolean;
    lines: string | undefined;
    linesFile: string | undefined;
    logs: boolean;
    recorderEvents: boolean;
    runEvents: boolean;
    runner: string | undefined;
    timeout: string | undefined;
  },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const timeout = parseFollowTimeout(options.timeout);
  if (!timeout.ok) {
    return { error: timeout.error, exitCode: exitCodes.invalidArgs };
  }

  // Before the runner, not after: collecting and checking the files costs
  // nothing and resolving a runner may launch and bill one. A misspelled flow
  // name should not be answered with a pod.
  const entryPointPath = toCollectedPath(deps.cwd, options.entryPoint);
  const prepared = await prepareRun(
    {
      entryPointPath,
      envFile: options.envFile,
      envId: options.envId,
      lines: options.lines,
      linesFile: options.linesFile,
    },
    deps,
  );
  if (!prepared.ok) {
    return { error: prepared.error, exitCode: prepared.exitCode };
  }

  const resolved = await resolveRunner(
    ctx,
    { autoLaunch: true, runner: options.runner },
    deps,
  );
  if (resolved.type === "failed") {
    return { ...failureFields(resolved), exitCode: resolved.exitCode };
  }
  announceRunner(ctx, resolved);

  let recorderSinceSequence: number | undefined;
  if (options.recorderEvents) {
    const anchor = await resolveRecorderAnchor(ctx, resolved, deps);
    if (!anchor.ok) return { ...anchor.failure };
    recorderSinceSequence = anchor.sinceSequence;
  }

  const submitted = await submitRun(
    ctx,
    {
      entryPointPath,
      environment: prepared.environment,
      environmentId: prepared.environmentId,
      files: prepared.files,
      resolved,
      selection: prepared.selection,
    },
    deps,
  );
  if (!submitted.ok) {
    const { ok: _ok, ...failure } = submitted;
    return failure;
  }
  if (submitted.bootstrappedRunner) {
    ctx.ui.info(interactiveRunnerMessages.bootstrappedForSelection);
  }

  const runId = submitted.runId;
  // The stream flags imply --follow: each only chooses what a follow prints, so
  // alone it can only mean "follow, with that stream".
  const follow =
    options.follow ||
    options.logs ||
    options.runEvents ||
    options.recorderEvents;
  if (!follow) {
    ctx.ui.output(
      { fileSync: submitted.fileSync, runId, runnerId: resolved.runnerId },
      interactiveRunnerMessages.runSubmitted(runId),
    );
    return undefined;
  }
  // A diagnostic while following, not the command's output: what stdout carries
  // then is the run's journal entries, and a differently shaped object among
  // them leaves a reader of the stream sniffing keys to tell which lines are log
  // entries.
  if (submitted.fileSync === "delta") {
    ctx.ui.info(interactiveRunnerMessages.shippedDelta);
  }
  ctx.ui.info(interactiveRunnerMessages.runSubmitted(runId));
  return followRun(
    ctx,
    {
      logs: options.logs,
      recorderSinceSequence,
      runEvents: options.runEvents,
      runId,
      runnerId: resolved.runnerId,
      timeoutSeconds: timeout.seconds,
    },
    deps,
  );
}
