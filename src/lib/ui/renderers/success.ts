import type { StyledClack } from "../clack/index.js";
import type { OutputMode } from "../env.js";
import { writeJsonDiagnostic, writeStderrLine } from "./write.js";

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
        writeStderrLine(message);
        break;
      case "json":
        writeJsonDiagnostic({ type: "success", message });
        break;
    }
  };
}
