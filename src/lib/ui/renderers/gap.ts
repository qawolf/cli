import type { OutputMode } from "../env.js";

type GapDeps = { mode: OutputMode };

export function createGap({ mode }: GapDeps): () => void {
  return (): void => {
    if (mode === "human") {
      process.stderr.write("\n");
    }
  };
}
