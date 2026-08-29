import { pluralize } from "~/core/pluralize.js";
import { lintFiles } from "~/domains/lint/lintFiles.js";
import { renderLintReport } from "~/domains/lint/renderLintReport.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

export async function handleLint(
  ctx: CommandContext,
  { files }: { files: string[] },
): Promise<CommandResult> {
  const report = await lintFiles({
    cwd: process.cwd(),
    filePaths: files,
    fs: ctx.fs,
  });

  renderLintReport(ctx.ui, report);

  const unreadable = report.files.filter((file) => file.type === "unreadable");
  if (unreadable.length > 0) {
    return {
      error: unreadable
        .map((file) => `${file.path}: ${file.reason}`)
        .join("\n"),
      exitCode: exitCodes.invalidArgs,
    };
  }

  if (report.errorCount > 0) {
    return {
      error: `${pluralize(report.errorCount, "lint error")} found`,
      exitCode: exitCodes.testFailure,
    };
  }
}
