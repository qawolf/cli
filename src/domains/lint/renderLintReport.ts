import type { WorkflowLintMessage } from "@qawolf/workflow-linter";

import { pluralize } from "~/core/pluralize.js";
import type { UI } from "~/shell/ui/types.js";
import type { LintReport } from "./lintFiles.js";

export function renderLintReport(ui: UI, report: LintReport): void {
  if (ui.mode === "json") {
    ui.json(report);
    return;
  }
  const output = formatLintReport(report);
  if (output.length > 0) ui.write(`${output}\n`);
}

export function formatLintReport(report: LintReport): string {
  const blocks = report.files
    .map((file) => formatFileMessages(file.path, file.messages))
    .filter((block) => block !== "");

  const problemCount = report.errorCount + report.warningCount;
  const summary =
    problemCount === 0
      ? []
      : [
          `${pluralize(problemCount, "problem")} (${pluralize(report.errorCount, "error")}, ${pluralize(report.warningCount, "warning")})`,
        ];

  return [...blocks, ...summary].join("\n\n");
}

function formatFileMessages(
  path: string,
  messages: WorkflowLintMessage[],
): string {
  if (messages.length === 0) return "";
  return [
    path,
    ...messages.map(
      (message) =>
        `  ${String(message.line)}:${String(message.column)}  ${message.severity === 2 ? "error" : "warning"}  ${message.message}  ${message.ruleId ?? "syntax-error"}`,
    ),
  ].join("\n");
}
