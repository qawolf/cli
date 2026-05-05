import { Command } from "commander";

import { registerAuthCommand } from "../commands/auth/index.js";
import packageJson from "../../package.json" with { type: "json" };

export function createProgram(): Command {
  const program = new Command()
    .name("qawolf")
    .description("Run QA Wolf flows locally")
    .version(packageJson.version)
    .option("--json", "Output as JSON")
    .option("--agent", "Output for agent consumption");

  registerAuthCommand(program);

  return program;
}
