import { type RunFiles, publicContractsV1 } from "@qawolf/api-contracts/v1";

import {
  checkSnippetFiles,
  describeRunFilesCheck,
  toCollectedPath,
} from "~/core/interactiveRunner/runFiles.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { describeEvaluateSnippetFailure } from "./evaluateSnippetFailure.js";
import { announceRunner, resolveRunner } from "./resolveRunner.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

const stdinArgument = "-";

type Scope =
  | { ok: true; filePath: string | undefined; files: RunFiles | undefined }
  | { ok: false; error: string };

/**
 * The scope a snippet is evaluated in. A runner holds no copy of the project, so
 * a snippet that touches the caller's own modules has to carry them: the named
 * file and everything the collector found beside it. Without `--file` the snippet
 * imports nothing of the caller's and nothing travels.
 */
async function resolveScope(
  contextFile: string | undefined,
  deps: InteractiveRunnerDeps,
): Promise<Scope> {
  if (contextFile === undefined) {
    return { filePath: undefined, files: undefined, ok: true };
  }
  const filePath = toCollectedPath(deps.cwd, contextFile);
  const { files } = await deps.collectRunFiles([filePath]);
  const check = checkSnippetFiles(files, filePath);
  if (check.type !== "ok") {
    return { error: describeRunFilesCheck(check), ok: false };
  }
  return { filePath, files, ok: true };
}

async function readCode(
  source: string,
  deps: InteractiveRunnerDeps,
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const code =
    source === stdinArgument
      ? await deps.readStdin()
      : await deps.readFile(source).catch(() => undefined);
  if (code === undefined) {
    return {
      error: interactiveRunnerMessages.snippetFileUnreadable(source),
      ok: false,
    };
  }
  if (code.trim() === "") {
    return source === stdinArgument
      ? { error: interactiveRunnerMessages.stdinEmptySnippet, ok: false }
      : { error: interactiveRunnerMessages.snippetEmpty(source), ok: false };
  }
  return { code, ok: true };
}

/**
 * Evaluates a snippet against whatever the runner's browser is showing.
 *
 * The contract answers whether the snippet ran, never what it evaluated to, so
 * nothing here may read as handing a value back: a caller who wants one prints it
 * and reads the `console` stream. A snippet starts no run, so there is nothing
 * run-scoped to follow either.
 */
export async function handleRunnerExec(
  ctx: AuthCommandContext,
  options: {
    contextFile: string | undefined;
    runner: string | undefined;
    source: string;
  },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const code = await readCode(options.source, deps);
  if (!code.ok) return { error: code.error, exitCode: exitCodes.invalidArgs };

  const scope = await resolveScope(options.contextFile, deps);
  if (!scope.ok) return { error: scope.error, exitCode: exitCodes.invalidArgs };

  const resolved = await resolveRunner(
    ctx,
    { autoLaunch: true, runner: options.runner },
    deps,
  );
  if (resolved.type === "failed") {
    return { ...failureFields(resolved), exitCode: resolved.exitCode };
  }
  announceRunner(ctx, resolved);

  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.evaluateSnippet,
    {
      code: code.code,
      id: resolved.runnerId,
      ...(scope.filePath === undefined ? {} : { filePath: scope.filePath }),
      ...(scope.files === undefined ? {} : { files: scope.files }),
    },
    runnerCallOptions,
  );
  if (!result.ok) {
    return {
      ...failureFields(result),
      exitCode: result.exitCode ?? exitCodes.network,
    };
  }

  if (result.value.outcome === "failure") {
    return describeEvaluateSnippetFailure(result.value);
  }

  switch (result.value.result) {
    case "success":
      ctx.ui.output(
        { outcome: "evaluated", result: "success" },
        interactiveRunnerMessages.snippetRan,
      );
      return undefined;
    case "stopped":
      return {
        error: interactiveRunnerMessages.snippetStopped,
        exitCode: exitCodes.testFailure,
      };
    case "error":
      return {
        error: interactiveRunnerMessages.snippetErrored(
          result.value.errorMessage,
        ),
        exitCode: exitCodes.testFailure,
      };
  }
}
