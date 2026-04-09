import type { StyledClack } from "../clack/index.js";
import type { OutputMode } from "../env.js";
import { assertHumanMode } from "./assertHumanMode.js";

type IntroDeps = { mode: OutputMode; clack: StyledClack };

export function createIntro({
  mode,
  clack,
}: IntroDeps): (title: string) => void {
  return (title: string): void => {
    assertHumanMode(mode, "intro");
    clack.intro(title);
  };
}
