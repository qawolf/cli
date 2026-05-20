import { createSignalRegistry } from "./shell/signals/createSignalRegistry.js";
import { createProgram } from "./commands/program.js";

const signals = createSignalRegistry();

let forced = false;
const onSignal = (sig: "SIGINT" | "SIGTERM") => () => {
  if (forced) process.exit(1);
  forced = true;
  void signals.shutdown(sig).finally(() => {
    process.exit(sig === "SIGINT" ? 130 : 143);
  });
};
process.on("SIGINT", onSignal("SIGINT"));
process.on("SIGTERM", onSignal("SIGTERM"));

createProgram({ signals }).parse();
