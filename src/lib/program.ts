import { Command } from "commander";

import { registerAuthCommand } from "../commands/auth/index.js";
import { registerFlowsCommand } from "../commands/flows/index.js";
import { registerInstallCommand } from "../commands/install/index.js";
import { registerDoctorCommand } from "../commands/doctor/index.js";
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
  registerInstallCommand(program);
  registerFlowsCommand(program);

  return program;
}
