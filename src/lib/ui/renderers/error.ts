import type { StyledClack } from "../clack/index.js";
import { formatCIError } from "./formatters/ci.js";
import type { OutputMode } from "../env.js";

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
      case "json":
        process.stderr.write(formatCIError(title, body));
        break;
    }
  };
}
