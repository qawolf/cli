import { Command } from "commander";

import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";
import { registerAuthCommand } from "./auth/index.js";
import { registerDoctorCommand } from "./doctor/index.js";
import { registerFlowsCommand } from "./flows/index.js";
import { registerInitCommand } from "./init/index.js";
import { registerInstallCommand } from "./install/index.js";
import { registerPublicApiCommands } from "./publicApi/index.js";
import { registerRunnerCommand } from "./runner/index.js";
import { exitCodes, exit } from "~/shell/exit.js";
import packageJson from "../../package.json" with { type: "json" };

export function createProgram({
  signals,
}: {
  signals: SignalRegistry;
}): Command {
  const program = new Command()
    .name("qawolf")
    .description("Run QA Wolf flows locally")
    .version(packageJson.version)
    .option("--verbose", "Enable debug logging to stderr")
    .option("--json", "Output as JSON")
    .option("--agent", "Output for agent consumption")
    .exitOverride((err) => {
      exit(err.exitCode === 0 ? exitCodes.success : exitCodes.invalidArgs);
    });

  registerAuthCommand(program, signals);
  registerDoctorCommand(program, signals);
  registerFlowsCommand(program, signals);
  registerInitCommand(program, signals);
  registerInstallCommand(program, signals);
  registerRunnerCommand(program, signals);
  registerPublicApiCommands(program, signals);

  return program;
}
