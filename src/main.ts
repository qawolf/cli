import { createSignalRegistry } from "./shell/signals/createSignalRegistry.js";
import { createProgram } from "./commands/program.js";
import { createSignalExit, exitWhenIdle } from "./shell/exit.js";

const signals = createSignalRegistry();

const onSignal = createSignalExit({ shutdown: (sig) => signals.shutdown(sig) });
process.on("SIGINT", onSignal("SIGINT"));
process.on("SIGTERM", onSignal("SIGTERM"));

// Settle the exit status once the command resolves — see exitWhenIdle for why
// the process is not killed here.
void createProgram({ signals })
  .parseAsync()
  .catch(() => {
    if (process.exitCode === undefined) process.exitCode = 1;
  })
  .finally(() =>
    exitWhenIdle(typeof process.exitCode === "number" ? process.exitCode : 0),
  );
