import type { TargetedRunner } from "~/domains/interactiveRunner/resolveRunner.js";

/**
 * An SDK caller names the runner in the call itself, so there is no flag,
 * variable or stored default behind it for a failure to report.
 */
export const givenRunner = (runnerId: string): TargetedRunner => ({
  runnerId,
  source: "given",
});
