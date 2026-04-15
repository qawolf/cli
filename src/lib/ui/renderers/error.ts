import type { StyledClack } from "~/lib/ui/clack/index.js";
import type { OutputMode } from "~/lib/ui/env.js";
import { formatCIError } from "./formatters/ci.js";
import { writeJsonDiagnostic } from "./write.js";

type ErrorDeps = { mode: OutputMode; clack: StyledClack };

export function createError({
  mode,
  clack,
}: ErrorDeps): (title: string, body?: string) => void {
  return (title: string, body?: string): void => {
    switch (mode) {
      case "human":
        clack.log.error(title + (body ? `\n${body}` : ""));
        break;
      case "agent":
        process.stderr.write(formatCIError(title, body));
        break;
      case "json":
        writeJsonDiagnostic({ type: "error", title, body });
        break;
    }
  };
}
