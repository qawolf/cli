import { describe, expect, it } from "bun:test";
import { Command } from "commander";
import { join } from "node:path";

import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import { createProgram } from "./program.js";
import { renderCommandsTable, spliceCommandsTable } from "./skill.js";

const skillMdPath = join(
  import.meta.dirname,
  "../../skills/qawolf-cli/SKILL.md",
);

describe("renderCommandsTable", () => {
  it("lists every visible command with its kind", () => {
    const table = renderCommandsTable(
      createProgram({ signals: makeNoopSignals() }),
    );
    expect(table).toContain("`qawolf run create`");
    expect(table).toContain("write");
    expect(table).toContain("`qawolf flows run`");
    expect(table).toContain("`qawolf install browsers`");
    // Hidden internals stay out of the skill.
    expect(table).not.toContain("__run-worker");
  });

  it("renders a conditional kind note when declared", () => {
    const table = renderCommandsTable(
      createProgram({ signals: makeNoopSignals() }),
    );
    expect(table).toContain("local (read with --remote)");
    expect(table).toContain("local (read with --env)");
  });

  it("throws on a command with no declared kind", () => {
    const program = new Command().name("qawolf");
    program.command("mystery").description("Unclassified command");
    expect(() => renderCommandsTable(program)).toThrow(
      'Command "mystery" has no kind. Declare it with declareCommandKind where the command is defined.',
    );
  });
});

// The table is generated; this guards the one real drift risk: changing
// commands and forgetting `bun run generate`. Flags are intentionally not in
// the skill — `qawolf <command> --help` is the authoritative reference.
describe("qawolf-cli skill", () => {
  it("contains the up-to-date generated commands table", async () => {
    const skillMd = await Bun.file(skillMdPath).text();
    const table = renderCommandsTable(
      createProgram({ signals: makeNoopSignals() }),
    );
    expect(skillMd).toBe(spliceCommandsTable(skillMd, table));
  });

  it("has frontmatter naming the skill", async () => {
    const skillMd = await Bun.file(skillMdPath).text();
    expect(skillMd).toStartWith("---\nname: qawolf-cli\ndescription:");
  });
});
