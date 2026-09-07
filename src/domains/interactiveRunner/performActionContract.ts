import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import type { z } from "zod";

import type { PublicApiContractOf } from "~/shell/platform/callPublicApi.js";

type PublishedInput = z.input<
  typeof publicContractsV1.runner.performAction.input
>;
type PublishedOutput = z.output<
  typeof publicContractsV1.runner.performAction.output
>;

export type PerformActionInput = PublishedInput & {
  /**
   * Ask the runner to wait for the screen to settle after the action and
   * answer with a JPEG of it, so one call replaces an action, a fixed delay
   * and a screenshot.
   */
  screenshot?: boolean;
};

export type PerformActionOutput =
  | Exclude<PublishedOutput, { outcome: "success" }>
  // The success answer, carrying the screen when one was asked for.
  | { outcome: "success"; imageJpegBase64?: string };

/**
 * `runner.performAction` as `act --screenshot` needs it: an input option asking
 * for a screenshot with the answer, and the image on the success.
 *
 * TODO WIZ-11973 The pinned @qawolf/api-contracts (0.39.0) has neither yet, so
 * this widens the published contract to the shape the platform change is
 * expected to ship. Delete this file and call the contract directly once the
 * release that carries the option is pinned. Until then the wire parser, which
 * is the pinned output schema, strips the image off the answer, so the flag
 * cannot work end to end.
 */
export const performActionContract = publicContractsV1.runner
  .performAction as unknown as PublicApiContractOf<
  PerformActionInput,
  PerformActionOutput
>;
