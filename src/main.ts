import { createSignalRegistry } from "./shell/signals/createSignalRegistry.js";
import { createProgram } from "./commands/program.js";
import { exitWhenIdle } from "./shell/exit.js";

const signals = createSignalRegistry();

let forced = false;
const onSignal = (sig: "SIGINT" | "SIGTERM") => () => {
  const code = sig === "SIGINT" ? 130 : 143;
  if (forced) process.exit(code);
  forced = true;
  void signals.shutdown(sig).finally(() => {
    process.exit(code);
  });
};
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
