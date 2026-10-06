#!/usr/bin/env bun
// Generates skills/qawolf-cli/SKILL.md from its source template and the
// Commander program tree, and references/runner.md from the runner commands'
// help.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { createProgram } from "~/commands/program.js";
import {
  renderCommandsTable,
  renderRunnerReferenceMd,
  spliceCommandsTable,
} from "~/commands/skill.js";
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
const runnerMdPath = join(
  import.meta.dirname,
  "../skills/qawolf-cli/references/runner.md",
);
const runResultsTemplatePath = join(
  import.meta.dirname,
  "../src/commands/qawolfCliRunResults.template.md",
);

const program = createProgram({ signals: makeNoopSignals() });
const skillTemplate = readFileSync(skillTemplatePath, "utf8");
const table = renderCommandsTable(program);
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

const runnerMd = renderRunnerReferenceMd(program);
if (runnerMd !== readFileSync(runnerMdPath, "utf8")) {
  writeFileSync(runnerMdPath, runnerMd);
  console.log("Updated skills/qawolf-cli/references/runner.md");
}
