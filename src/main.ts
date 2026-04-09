import { Command } from "commander";

import { registerAuthCommand } from "./commands/auth/index.js";

const program = new Command()
  .name("qawolf")
  .description("Tools for agents, CI, and humans to interact with QA Wolf")
  .version("0.1.0")
  .option("--json", "Output as JSON")
  .option("--agent", "Output for agent consumption");

registerAuthCommand(program);

program.parse();
