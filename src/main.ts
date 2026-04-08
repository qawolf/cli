import { Command } from "commander";

const program = new Command()
  .name("qawolf")
  .description("Tools for agents, CI, and humans to interact with QA Wolf")
  .version("0.1.0");

program.parse();
