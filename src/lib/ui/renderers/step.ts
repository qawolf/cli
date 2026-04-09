import type { StyledClack } from "../clack/index.js";
import type { OutputMode } from "../env.js";

type StepDeps = { mode: OutputMode; clack: StyledClack };

export function createStep({
  mode,
  clack,
}: StepDeps): (message: string) => void {
  return (message: string): void => {
    switch (mode) {
      case "human":
        clack.log.step(message);
        break;
      case "agent":
      case "json":
        process.stderr.write(`  ${message}\n`);
        break;
    }
  };
}
