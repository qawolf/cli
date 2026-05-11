import { Command } from "commander";

import { registerAuthCommand } from "../commands/auth/index.js";
import { registerInstallCommand } from "../commands/install/index.js";
import { registerDoctorCommand } from "../doctor/index.js";
import { EXIT_CODES, exit } from "~/exit.js";
import packageJson from "../../package.json" with { type: "json" };

export function createProgram(): Command {
  const program = new Command()
    .name("qawolf")
    .description("Run QA Wolf flows locally")
    .version(packageJson.version)
    .option("--json", "Output as JSON")
    .option("--agent", "Output for agent consumption")
    .exitOverride((err) => {
      exit(err.exitCode === 0 ? EXIT_CODES.success : EXIT_CODES.invalidArgs);
    });

  registerAuthCommand(program);
  registerDoctorCommand(program);
  registerInstallCommand(program);

  return program;
}
