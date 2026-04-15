import type { StyledClack } from "~/lib/ui/clack/index.js";
import type { OutputMode } from "~/lib/ui/env.js";
import { writeJsonDiagnostic, writeStderrLine } from "./write.js";

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
        writeStderrLine(message);
        break;
      case "json":
        writeJsonDiagnostic({ type: "step", message });
        break;
    }
  };
}
