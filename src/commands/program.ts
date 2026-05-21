import { Command } from "commander";

import { registerAuthCommand } from "./auth/index.js";
import { registerDoctorCommand } from "./doctor/index.js";
import { registerFlowsCommand } from "./flows/index.js";
import { registerInitCommand } from "./init/index.js";
import { registerInstallCommand } from "./install/index.js";
import { exitCodes, exit } from "~/shell/exit.js";
import packageJson from "../../package.json" with { type: "json" };

export function createProgram(): Command {
  const program = new Command()
    .name("qawolf")
    .description("Run QA Wolf flows locally")
    .version(packageJson.version)
    .option("--json", "Output as JSON")
    .option("--agent", "Output for agent consumption")
    .exitOverride((err) => {
      exit(err.exitCode === 0 ? exitCodes.success : exitCodes.invalidArgs);
    });

  registerAuthCommand(program);
  registerDoctorCommand(program);
  registerFlowsCommand(program);
  registerInitCommand(program);
  registerInstallCommand(program);

  return program;
}
