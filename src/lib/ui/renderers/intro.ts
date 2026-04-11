import type { StyledClack } from "../clack/index.js";
import type { OutputMode } from "../env.js";
import { writeJsonDiagnostic, writeStderrLine } from "./write.js";

type IntroDeps = { mode: OutputMode; clack: StyledClack };

export function createIntro({
  mode,
  clack,
}: IntroDeps): (title: string) => void {
  return (title: string): void => {
    switch (mode) {
      case "human":
        clack.intro(title);
        break;
      case "agent":
        writeStderrLine(title);
        break;
      case "json":
        writeJsonDiagnostic({ type: "intro", title });
        break;
    }
  };
}
