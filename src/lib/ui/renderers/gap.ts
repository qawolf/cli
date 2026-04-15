import type { OutputMode } from "~/lib/ui/env.js";
import { writeStderrLine } from "./write.js";

type GapDeps = { mode: OutputMode };

export function createGap({ mode }: GapDeps): () => void {
  return (): void => {
    if (mode !== "json") {
      writeStderrLine("");
    }
  };
}
