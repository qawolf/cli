import type { OutputMode } from "../env.js";

type GapDeps = { mode: OutputMode };

export function createGap({ mode }: GapDeps): () => void {
  return (): void => {
    if (mode !== "json") {
      process.stderr.write("\n");
    }
  };
}
