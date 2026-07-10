import { createSignalRegistry } from "./shell/signals/createSignalRegistry.js";
import { createProgram } from "./commands/program.js";
import { flushAndExit } from "./shell/exit.js";

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

// Exit deterministically once the command resolves — see flushAndExit for why.
void createProgram({ signals })
  .parseAsync()
  .catch(() => {
    if (process.exitCode === undefined) process.exitCode = 1;
  })
  .finally(() =>
    flushAndExit(typeof process.exitCode === "number" ? process.exitCode : 0),
  );
