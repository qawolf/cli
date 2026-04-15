import type { StyledClack } from "~/lib/ui/clack/index.js";
import type { OutputMode } from "~/lib/ui/env.js";
import { writeJsonLine, writeStderrLine } from "./write.js";

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
        writeJsonLine(data);
        break;
      case "agent":
        writeStderrLine(humanMessage);
        break;
    }
  };
}
