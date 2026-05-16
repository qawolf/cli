import type { StyledClack } from "~/shell/ui/clack/index.js";
import type { OutputMode } from "~/shell/ui/env.js";
import { writeJsonDiagnostic, writeStderrLine } from "./write.js";

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
        writeStderrLine(message);
        break;
      case "json":
        writeJsonDiagnostic({ type: "info", message });
        break;
    }
  };
}
