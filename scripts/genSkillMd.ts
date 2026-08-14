#!/usr/bin/env bun
// Generates skills/qawolf-cli/SKILL.md from its source template and the
// Commander program tree.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { createProgram } from "~/commands/program.js";
import { renderCommandsTable, spliceCommandsTable } from "~/commands/skill.js";
import {
  renderResponseFields,
  spliceResponseFields,
} from "~/commands/skillRunResults.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

const skillMdPath = join(import.meta.dirname, "../skills/qawolf-cli/SKILL.md");
const skillTemplatePath = join(
  import.meta.dirname,
  "../src/commands/qawolfCliSkill.template.md",
);
const runResultsMdPath = join(
  import.meta.dirname,
  "../skills/qawolf-cli/references/run-results.md",
);
const runResultsTemplatePath = join(
  import.meta.dirname,
  "../src/commands/qawolfCliRunResults.template.md",
);

const skillTemplate = readFileSync(skillTemplatePath, "utf8");
const table = renderCommandsTable(
  createProgram({ signals: makeNoopSignals() }),
);
const skillMd = spliceCommandsTable(skillTemplate, table);
const currentSkillMd = readFileSync(skillMdPath, "utf8");
if (skillMd !== currentSkillMd) {
  writeFileSync(skillMdPath, skillMd);
  console.log("Updated skills/qawolf-cli/SKILL.md");
}

const runResultsMd = spliceResponseFields(
  readFileSync(runResultsTemplatePath, "utf8"),
  renderResponseFields(publicContractsV1.run.get),
);
if (runResultsMd !== readFileSync(runResultsMdPath, "utf8")) {
  writeFileSync(runResultsMdPath, runResultsMd);
  console.log("Updated skills/qawolf-cli/references/run-results.md");
}
