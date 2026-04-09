import type { StyledClack } from "../clack/index.js";
import type { OutputMode } from "../env.js";

type CancelDeps = { mode: OutputMode; clack: StyledClack };

export function createCancel({
  mode,
  clack,
}: CancelDeps): (message: string) => void {
  return (message: string): void => {
    switch (mode) {
      case "human":
        clack.cancel(message);
        break;
      case "agent":
      case "json":
        process.stderr.write(`  ${message}\n`);
        break;
    }
  };
}
