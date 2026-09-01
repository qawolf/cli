import { lintMessages } from "~/core/messages/index.js";
import { buildPatternArgs } from "~/core/patternArgs.js";
import { pluralize } from "~/core/pluralize.js";
import { expandPatterns as defaultExpandPatterns } from "~/domains/flows/expand.js";
import {
  lintFiles as defaultLintFiles,
  lintablePattern,
  selectLintableFiles,
} from "~/domains/lint/lintFiles.js";
import { renderLintReport } from "~/domains/lint/renderLintReport.js";
import { noMatchResult } from "~/domains/runner/noMatch.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import type { Fs } from "~/shell/fs.js";
import type { Logger } from "~/shell/logger.js";

export type FlowsLintFlags = { readonly allowNoMatch: boolean };

export type HandleFlowsLintDeps = {
  expandPatterns: (
    patterns: string[],
    cwd: string,
    logger?: Logger,
  ) => Promise<string[]>;
  lintFiles: typeof defaultLintFiles;
};

function makeDefaultDeps(fs: Fs): HandleFlowsLintDeps {
  return {
    expandPatterns: (patterns, cwd, logger) =>
      defaultExpandPatterns(patterns, cwd, logger, fs),
    lintFiles: defaultLintFiles,
  };
}

export async function handleFlowsLint(
  ctx: CommandContext,
  pattern: string | undefined,
  flags: FlowsLintFlags,
  deps?: HandleFlowsLintDeps,
): Promise<CommandResult> {
  const resolvedDeps = deps ?? makeDefaultDeps(ctx.fs);
  const cwd = process.cwd();

  const matched = await resolvedDeps.expandPatterns(
    buildPatternArgs(pattern ?? lintablePattern),
    cwd,
    ctx.log("flows"),
  );
  const files = selectLintableFiles(matched);
  if (files.length === 0) {
    return noMatchResult(ctx, {
      allowNoMatch: flags.allowNoMatch,
      error: lintMessages.noFilesMatchedPattern(pattern),
      notice: lintMessages.noFilesMatched,
    });
  }

  const report = await resolvedDeps.lintFiles({
    cwd,
    filePaths: files,
    fs: ctx.fs,
  });
  renderLintReport(ctx.ui, report);

  if (report.errorCount > 0) {
    return {
      error: `${pluralize(report.errorCount, "lint error")} found`,
      exitCode: exitCodes.testFailure,
    };
  }
}
