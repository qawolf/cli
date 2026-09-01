import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withContext } from "~/commands/context.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { type FlowsLintFlags, handleFlowsLint } from "./lintDefaults.js";

const lintExamples = `
Examples:
  $ qawolf flows lint
  $ qawolf flows lint "flows/checkout/**"
  $ qawolf flows lint "src/pages/**/*.ts"
  $ qawolf flows lint flows/login.flow.ts

Exits 1 when a file has a lint error, and 0 when every file is clean or only
has warnings.`;

export function registerFlowsLintCommand(
  flows: Command,
  signals: SignalRegistry,
): void {
  declareCommandKind(flows.command("lint [pattern]"), "local")
    .description(
      "Lint source files matching [pattern], or every .ts/.js file when omitted, with QA Wolf's rules, honoring the project's .eslintrc.json",
    )
    .option(
      "--allow-no-match",
      "Exit 0 instead of 2 when the pattern selects no lintable file",
      false,
    )
    .addHelpText("after", lintExamples)
    .action(
      (pattern: string | undefined, opts: FlowsLintFlags, command: Command) => {
        return withContext(signals, (ctx) =>
          handleFlowsLint(ctx, pattern, opts),
        )(opts, command);
      },
    );
}
