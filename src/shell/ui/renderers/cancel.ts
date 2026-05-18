import type { StyledClack } from "~/shell/ui/clack/index.js";
import type { OutputMode } from "~/shell/ui/env.js";
import { writeJsonDiagnostic, writeStderrLine } from "./write.js";

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
        writeStderrLine(message);
        break;
      case "json":
        writeJsonDiagnostic({ type: "cancel", message });
        break;
    }
  };
}
