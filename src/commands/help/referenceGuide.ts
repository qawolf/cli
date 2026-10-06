import type { Command } from "commander";

const guides = new WeakMap<Command, string>();

/**
 * Attaches a Markdown guide that `qawolf help ref` prints above the command's
 * help, for what spans its subcommands and would make `--help` too long.
 * The guide's top headings are `##`, one level below the command's own.
 */
export function declareReferenceGuide<GuidedCommand extends Command>(
  command: GuidedCommand,
  markdown: string,
): GuidedCommand {
  guides.set(command, markdown);
  return command;
}

function shiftHeadings(markdown: string, levels: number): string {
  const lines = markdown.trim().split("\n");
  const shifted = lines.reduce<{ inFence: boolean; lines: string[] }>(
    (state, line) => {
      if (line.startsWith("```")) {
        return { inFence: !state.inFence, lines: [...state.lines, line] };
      }
      const isHeading = !state.inFence && /^#{1,6} /.test(line);
      const shiftedLine = isHeading ? `${"#".repeat(levels)}${line}` : line;
      return { inFence: state.inFence, lines: [...state.lines, shiftedLine] };
    },
    { inFence: false, lines: [] },
  );
  return shifted.lines.join("\n");
}

/** The guide for a command whose heading sits at `depth`, or undefined. */
export function renderReferenceGuide(
  command: Command,
  depth: number,
): string | undefined {
  const guide = guides.get(command);
  return guide === undefined ? undefined : shiftHeadings(guide, depth - 1);
}
