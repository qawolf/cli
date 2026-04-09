import type { StyledClack } from "../clack/index.js";
import type { OutputMode } from "../env.js";

type OutroDeps = { mode: OutputMode; clack: StyledClack };

export function createOutro({
  mode,
  clack,
}: OutroDeps): (message: string) => void {
  return (message: string): void => {
    switch (mode) {
      case "human":
        clack.outro(message);
        break;
      case "agent":
      case "json":
        process.stderr.write(`  ${message}\n`);
        break;
    }
  };
}
