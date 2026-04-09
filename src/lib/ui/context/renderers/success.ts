import type { StyledClack } from "../../clack/index.js";
import type { OutputMode } from "../../env.js";
import { assertHumanMode } from "../assertHumanMode.js";

type SuccessDeps = { mode: OutputMode; clack: StyledClack };

export function createSuccess({
  mode,
  clack,
}: SuccessDeps): (message: string) => void {
  return (message: string): void => {
    assertHumanMode(mode, "success");
    clack.log.success(message);
  };
}
