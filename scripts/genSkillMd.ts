#!/usr/bin/env bun
// Generates the qawolf-cli skill files from their source templates and the
// Commander program tree: SKILL.md (verbatim from its template) and the
// commands reference (its template with the generated command table spliced in).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createProgram } from "~/commands/program.js";
import { renderCommandsTable, spliceCommandsTable } from "~/commands/skill.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

const skillDir = join(import.meta.dirname, "../skills/qawolf-cli");
const templateDir = join(import.meta.dirname, "../src/commands");

function writeIfChanged(path: string, next: string): void {
  if (readFileSync(path, "utf8") !== next) {
    writeFileSync(path, next);
    console.log(`Updated ${path}`);
  }
}

const table = renderCommandsTable(
  createProgram({ signals: makeNoopSignals() }),
);

writeIfChanged(
  join(skillDir, "SKILL.md"),
  readFileSync(join(templateDir, "qawolfCliSkill.template.md"), "utf8"),
);
writeIfChanged(
  join(skillDir, "references/commands.md"),
  spliceCommandsTable(
    readFileSync(join(templateDir, "qawolfCliCommands.template.md"), "utf8"),
    table,
  ),
);
