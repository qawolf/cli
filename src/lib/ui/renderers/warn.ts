import type { StyledClack } from "../clack/index.js";
import type { OutputMode } from "../env.js";

type WarnDeps = { mode: OutputMode; clack: StyledClack };

export function createWarn({
  mode,
  clack,
}: WarnDeps): (message: string) => void {
  return (message: string): void => {
    switch (mode) {
      case "human":
        clack.log.warn(message);
        break;
      case "agent":
        process.stderr.write(`${message}\n`);
        break;
      case "json":
        process.stderr.write(JSON.stringify({ type: "warn", message }) + "\n");
        break;
    }
  };
}
