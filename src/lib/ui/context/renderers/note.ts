import type { StyledClack } from "../../clack/index.js";
import type { OutputMode } from "../../env.js";

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
        process.stderr.write(`  ${title ? `${title}: ` : ""}${message}\n`);
        break;
      case "json":
        break;
    }
  };
}
