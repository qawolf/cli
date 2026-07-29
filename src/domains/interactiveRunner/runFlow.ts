import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { isAbsolute, relative, resolve, sep } from "node:path";

import { checkRunFiles } from "~/core/interactiveRunner/runFiles.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { followRun } from "./followRun.js";
import { announceRunner, resolveRunner } from "./resolveRunner.js";

/**
 * The path the request names the entry point by, which is the path the file
 * travels under: relative to the directory the files were collected from, with
 * forward slashes whatever the platform's separator is.
 */
function toCollectedPath(cwd: string, entryPoint: string): string {
  const absolute = isAbsolute(entryPoint)
    ? entryPoint
    : resolve(cwd, entryPoint);
  return relative(cwd, absolute).split(sep).join("/");
}

function describeCheck(
  check: Exclude<ReturnType<typeof checkRunFiles>, { type: "ok" }>,
): string {
  switch (check.type) {
    case "missing-entry-point":
      return interactiveRunnerMessages.entryPointNotCollected(
        check.entryPointPath,
      );
    case "missing-package-json":
      return interactiveRunnerMessages.missingPackageJson;
    case "too-large":
      return interactiveRunnerMessages.filesTooLarge(
        check.byteLength,
        check.maxByteLength,
      );
  }
}

export async function handleRunnerRun(
  ctx: AuthCommandContext,
  options: { entryPoint: string; follow: boolean; runner: string | undefined },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const resolved = await resolveRunner(
    ctx,
    { autoLaunch: true, runner: options.runner },
    deps,
  );
  if (resolved.type === "failed") {
    return { error: resolved.error, exitCode: resolved.exitCode };
  }
  announceRunner(ctx, resolved);

  const entryPointPath = toCollectedPath(deps.cwd, options.entryPoint);
  const files = await deps.collectRunFiles();
  const check = checkRunFiles(files, entryPointPath);
  if (check.type !== "ok") {
    return { error: describeCheck(check), exitCode: exitCodes.invalidArgs };
  }

  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.runFlow,
    { entryPointPath, files, id: resolved.runnerId },
  );
  if (!result.ok) {
    return { error: result.error, exitCode: exitCodes.network };
  }

  switch (result.value.outcome) {
    case "runner-target-mismatch":
      return {
        error: interactiveRunnerMessages.targetMismatch(
          result.value.runnerName,
          result.value.requiredRunnerName,
        ),
        exitCode: exitCodes.invalidArgs,
      };
    case "runner-unreachable":
      // Never a retry suggestion: the run may have started and been too slow to
      // say so, and running the flow again would bill a second one.
      return {
        error: interactiveRunnerMessages.submitMayHaveStarted,
        exitCode: exitCodes.network,
      };
    case "submitted": {
      const runId = result.value.runId;
      ctx.ui.output(
        { runId, runnerId: resolved.runnerId },
        interactiveRunnerMessages.runSubmitted(runId),
      );
      if (!options.follow) return undefined;
      return followRun(ctx, { runId, runnerId: resolved.runnerId }, deps);
    }
  }
}
