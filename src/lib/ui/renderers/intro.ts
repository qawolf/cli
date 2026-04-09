import type { StyledClack } from "../clack/index.js";
import type { OutputMode } from "../env.js";

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
        process.stderr.write(`${title}\n`);
        break;
      case "json":
        process.stderr.write(JSON.stringify({ type: "intro", title }) + "\n");
        break;
    }
  };
}
