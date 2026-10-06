import type { Command } from "commander";

import { listVisibleSubcommands } from "./commandTree.js";
import { renderReferenceGuide } from "./referenceGuide.js";

// Fixed rather than the terminal's width, so the reference reads the same in
// every terminal and in the files generated from it.
const referenceHelpWidth = 100;
const deepestHeadingLevel = 6;

// Captures what `--help` prints rather than calling `helpInformation()`, which
// leaves out the text added with `addHelpText`. Commander only writes help
// through the command's output configuration, so it is swapped for the
// capture and restored after.
function formatCommandHelp(command: Command): string {
  const originalOutput = command.configureOutput();
  const chunks: string[] = [];
  command.configureOutput({
    getOutHasColors: () => false,
    getOutHelpWidth: () => referenceHelpWidth,
    writeOut: (text) => chunks.push(text),
  });
  try {
    command.outputHelp();
  } finally {
    command.configureOutput(originalOutput);
  }
  return chunks.join("").trimEnd();
}

function renderSections(
  command: Command,
  path: readonly string[],
  depth: number,
): string[] {
  const heading = `${"#".repeat(Math.min(depth, deepestHeadingLevel))} ${path.join(" ")}`;
  const help = ["```text", formatCommandHelp(command), "```"].join("\n");
  const guide = renderReferenceGuide(command, depth);
  const section = [heading, ...(guide === undefined ? [] : [guide]), help].join(
    "\n\n",
  );
  return [
    section,
    ...listVisibleSubcommands(command).flatMap((child) =>
      renderSections(child, [...path, child.name()], depth + 1),
    ),
  ];
}

/**
 * The full `--help` of `command` and of every visible command under it, as
 * Markdown: one heading per command, nested by depth, followed by the guide
 * declared for it, if any, and its help in a text block. `path` is the command's full name, e.g. `["qawolf", "runner"]`.
 */
export function renderHelpReference(
  command: Command,
  path: readonly string[],
): string {
  return `${renderSections(command, path, 1).join("\n\n")}\n`;
}
