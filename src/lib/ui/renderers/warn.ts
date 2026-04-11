import type { StyledClack } from "../clack/index.js";
import type { OutputMode } from "../env.js";
import { writeJsonDiagnostic, writeStderrLine } from "./write.js";

type WarnDeps = { mode: OutputMode; clack: StyledClack };

export function createWarn({
  mode,
  clack,
}: WarnDeps): (message: string) => void {
  return (message: string): void => {
    switch (mode) {
      case "human":
        clack.log.warn(message);
        break;
      case "agent":
        writeStderrLine(message);
        break;
      case "json":
        writeJsonDiagnostic({ type: "warn", message });
        break;
    }
  };
}
