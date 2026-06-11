#!/usr/bin/env bun
// Regenerates the commands table in skills/qawolf-cli/SKILL.md from the
// Commander program tree. Runs as part of `bun run generate`; the prose
// around the table is hand-written and stays untouched.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createProgram } from "~/commands/program.js";
import { renderCommandsTable, spliceCommandsTable } from "~/commands/skill.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

const skillMdPath = join(import.meta.dirname, "../skills/qawolf-cli/SKILL.md");

const skillMd = readFileSync(skillMdPath, "utf8");
const table = renderCommandsTable(
  createProgram({ signals: makeNoopSignals() }),
);
const updated = spliceCommandsTable(skillMd, table);
if (updated !== skillMd) {
  writeFileSync(skillMdPath, updated);
  console.log("Updated skills/qawolf-cli/SKILL.md commands table");
}
