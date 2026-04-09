import type { StyledClack } from "../clack/index.js";
import type { OutputMode } from "../env.js";
import { assertHumanMode } from "./assertHumanMode.js";

type StepDeps = { mode: OutputMode; clack: StyledClack };

export function createStep({
  mode,
  clack,
}: StepDeps): (message: string) => void {
  return (message: string): void => {
    assertHumanMode(mode, "step");
    clack.log.step(message);
  };
}
