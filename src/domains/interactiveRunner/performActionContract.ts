import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

const published = publicContractsV1.runner.performAction;

/**
 * `runner.performAction` as `act --screenshot` needs it: an input option asking
 * for a screenshot with the answer, and the image on the success.
 *
 * TODO WIZ-11973 The pinned @qawolf/api-contracts (0.39.0) has neither yet, so
 * this widens the published contract to the shape the platform change is
 * expected to ship. A schema rather than a type cast, so the wire parser keeps
 * the image and the flag can be tried against a platform that has the change.
 * Delete this file and call the contract directly once the release that carries
 * the option is pinned; `performActionFailure.ts` then flags any failure reason
 * the release adds through its `satisfies never`.
 */
export const performActionContract = {
  ...published,
  input: published.input.extend({
    screenshot: z
      .boolean()
      .optional()
      .describe(
        "Answer with a JPEG of the screen after the action, as imageJpegBase64.",
      ),
  }),
  output: z.discriminatedUnion("outcome", [
    z.object({
      imageJpegBase64: z.string().min(1).optional(),
      outcome: z.literal("success"),
    }),
    published.output.options[1],
  ]),
} as const;
