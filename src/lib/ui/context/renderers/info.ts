import type { StyledClack } from "../../clack/index.js";
import type { OutputMode } from "../../env.js";

type InfoDeps = { mode: OutputMode; clack: StyledClack };

export function createInfo({
  mode,
  clack,
}: InfoDeps): (message: string) => void {
  return (message: string): void => {
    switch (mode) {
      case "human":
        clack.log.info(message);
        break;
      case "agent":
        process.stderr.write(`  ${message}\n`);
        break;
      case "json":
        break;
    }
  };
}
