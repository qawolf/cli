import type { StyledClack } from "../../clack/index.js";
import type { OutputMode } from "../../env.js";
import { assertHumanMode } from "../assertHumanMode.js";

type OutroDeps = { mode: OutputMode; clack: StyledClack };

export function createOutro({
  mode,
  clack,
}: OutroDeps): (message: string) => void {
  return (message: string): void => {
    assertHumanMode(mode, "outro");
    clack.outro(message);
  };
}
