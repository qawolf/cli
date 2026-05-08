import type { StyledClack } from "~/lib/ui/clack/index.js";
import type { OutputMode } from "~/lib/ui/env.js";
import { writeJsonDiagnostic, writeStderrLine } from "./write.js";

type StepProgress = { current: number; total: number };

type StepDeps = { mode: OutputMode; clack: StyledClack };

export function createStep({
  mode,
  clack,
}: StepDeps): (message: string, progress?: StepProgress) => void {
  return (message: string, progress?: StepProgress): void => {
    const framed = progress
      ? `[${String(progress.current)}/${String(progress.total)}] ${message}`
      : message;
    switch (mode) {
      case "human":
        clack.log.step(framed);
        break;
      case "agent":
        writeStderrLine(framed);
        break;
      case "json":
        writeJsonDiagnostic({
          type: "step",
          message,
          step: progress?.current,
          total: progress?.total,
        });
        break;
    }
  };
}
