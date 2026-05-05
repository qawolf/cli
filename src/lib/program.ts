import { Command } from "commander";

import { registerAuthCommand } from "../commands/auth/index.js";
import packageJson from "../../package.json" with { type: "json" };

export function createProgram(): Command {
  const program = new Command()
    .name("qawolf")
    .description("Tools for agents, CI, and humans to interact with QA Wolf")
    .version(packageJson.version)
    .option("--json", "Output as JSON")
    .option("--agent", "Output for agent consumption");

  registerAuthCommand(program);

  return program;
}
