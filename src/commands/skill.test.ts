import { describe, expect, it } from "bun:test";
import { type Command, Help } from "commander";
import { join } from "node:path";

import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import { createProgram } from "./program.js";

const skillMdPath = join(
  import.meta.dirname,
  "../../skills/qawolf-cli/SKILL.md",
);

function listLeafCommandPaths(command: Command, prefix: string[]): string[][] {
  // visibleCommands excludes commands registered with { hidden: true },
  // which are internal and must stay out of the skill.
  const children = new Help()
    .visibleCommands(command)
    .filter((child) => child.name() !== "help");
  if (children.length === 0) return [prefix];
  return children.flatMap((child) =>
    listLeafCommandPaths(child, [...prefix, child.name()]),
  );
}

// The skill is hand-written; this guards the one real drift risk: adding a
// command and forgetting to mention it. Flags are intentionally not in the
// skill — `qawolf <command> --help` is the authoritative reference.
describe("qawolf-cli skill", () => {
  it("mentions every registered command", async () => {
    const program = createProgram({ signals: makeNoopSignals() });
    const skillMd = await Bun.file(skillMdPath).text();

    const commandPaths = listLeafCommandPaths(program, []).map(
      (path) => `qawolf ${path.join(" ")}`,
    );
    expect(commandPaths.length).toBeGreaterThan(0);
    for (const commandPath of commandPaths) {
      expect(skillMd).toContain(`\`${commandPath}\``);
    }
  });

  it("has frontmatter naming the skill", async () => {
    const skillMd = await Bun.file(skillMdPath).text();
    expect(skillMd).toStartWith("---\nname: qawolf-cli\ndescription:");
  });
});
