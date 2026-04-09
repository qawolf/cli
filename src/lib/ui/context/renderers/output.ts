import type { StyledClack } from "../../clack/index.js";
import type { OutputMode } from "../../env.js";

type OutputDeps = { mode: OutputMode; clack: StyledClack };

export function createOutput({
  mode,
  clack,
}: OutputDeps): (data: unknown, humanMessage: string) => void {
  return (data: unknown, humanMessage: string): void => {
    switch (mode) {
      case "human":
        clack.log.info(humanMessage);
        break;
      case "json":
        process.stdout.write(JSON.stringify(data) + "\n");
        break;
      case "agent":
        process.stderr.write(`  ${humanMessage}\n`);
        break;
    }
  };
}
