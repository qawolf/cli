import type { StyledClack } from "../../clack/index.js";
import type { OutputMode } from "../../env.js";
import { assertHumanMode } from "../assertHumanMode.js";

type CancelDeps = { mode: OutputMode; clack: StyledClack };

export function createCancel({
  mode,
  clack,
}: CancelDeps): (message: string) => void {
  return (message: string): void => {
    assertHumanMode(mode, "cancel");
    clack.cancel(message);
  };
}
