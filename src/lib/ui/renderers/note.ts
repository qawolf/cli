import type { StyledClack } from "../clack/index.js";
import type { OutputMode } from "../env.js";
import { writeJsonDiagnostic, writeStderrLine } from "./write.js";

type NoteDeps = { mode: OutputMode; clack: StyledClack };

export function createNote({
  mode,
  clack,
}: NoteDeps): (message: string, title?: string) => void {
  return (message: string, title?: string): void => {
    switch (mode) {
      case "human":
        clack.note(message, title);
        break;
      case "agent":
        writeStderrLine(`${title ? `${title}: ` : ""}${message}`);
        break;
      case "json":
        writeJsonDiagnostic({ type: "note", title, message });
        break;
    }
  };
}
