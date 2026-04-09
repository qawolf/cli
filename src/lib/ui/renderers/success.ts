import type { StyledClack } from "../clack/index.js";
import type { OutputMode } from "../env.js";

type SuccessDeps = { mode: OutputMode; clack: StyledClack };

export function createSuccess({
  mode,
  clack,
}: SuccessDeps): (message: string) => void {
  return (message: string): void => {
    switch (mode) {
      case "human":
        clack.log.success(message);
        break;
      case "agent":
      case "json":
        process.stderr.write(`  ${message}\n`);
        break;
    }
  };
}
