import type { StyledClack } from "../../clack/index.js";
import type { OutputMode } from "../../env.js";
import { assertHumanMode } from "../assertHumanMode.js";

type WarnDeps = { mode: OutputMode; clack: StyledClack };

export function createWarn({
  mode,
  clack,
}: WarnDeps): (message: string) => void {
  return (message: string): void => {
    assertHumanMode(mode, "warn");
    clack.log.warn(message);
  };
}
