import { Command } from "commander";

import { registerAuthCommand } from "../commands/auth/index.js";
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
      const isHelpOrVersion =
        err.code === "commander.help" ||
        err.code === "commander.helpDisplayed" ||
        err.code === "commander.version";
      exit(isHelpOrVersion ? EXIT_CODES.success : EXIT_CODES.invalidArgs);
    });

  registerAuthCommand(program);

  return program;
}
