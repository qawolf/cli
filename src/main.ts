import { createSignalRegistry } from "./shell/signals/createSignalRegistry.js";
import { createProgram } from "./commands/program.js";

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

createProgram({ signals }).parse();
