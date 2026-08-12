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
const skillTemplatePath = join(
  import.meta.dirname,
  "qawolfCliSkill.template.md",
);
const commandsMdPath = join(
  import.meta.dirname,
  "../../skills/qawolf-cli/references/commands.md",
);
const commandsTemplatePath = join(
  import.meta.dirname,
  "qawolfCliCommands.template.md",
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

describe("qawolf-cli skill", () => {
  it("SKILL.md matches its template", async () => {
    const skillMd = await Bun.file(skillMdPath).text();
    const skillTemplate = await Bun.file(skillTemplatePath).text();
    expect(skillMd).toBe(skillTemplate);
  });

  it("references/commands.md matches its template and generated table", async () => {
    const commandsMd = await Bun.file(commandsMdPath).text();
    const commandsTemplate = await Bun.file(commandsTemplatePath).text();
    const table = renderCommandsTable(
      createProgram({ signals: makeNoopSignals() }),
    );
    expect(commandsMd).toBe(spliceCommandsTable(commandsTemplate, table));
  });

  it("keeps the full command table out of SKILL.md", async () => {
    const skillMd = await Bun.file(skillMdPath).text();
    expect(skillMd).not.toContain("commands-table:start");
    expect(skillMd).toContain("references/commands.md");
  });

  it("has frontmatter naming the skill", async () => {
    const skillMd = await Bun.file(skillMdPath).text();
    expect(skillMd).toStartWith("---\nname: qawolf-cli\ndescription:");
  });
});
