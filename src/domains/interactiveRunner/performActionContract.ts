import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

const published = publicContractsV1.runner.performAction;
const publishedFailure = published.output.options[1];

const screenshotAfterAction = z.string().min(1).optional();

/**
 * `runner.performAction` as `act --screenshot` needs it: `withScreenshot` on the
 * input, and `imageJpegBase64` on both answers that reached the screen, since an
 * action that did not take effect still has a screen worth seeing.
 *
 * TODO WIZ-11973 The platform carries this (qawolf/qawolf#32936) but no
 * @qawolf/api-contracts release does yet: the newest published is 0.48.0 and the
 * change is in the unreleased 0.51.0. This mirrors the merged schema so the wire
 * parser keeps the image and the flag works against a platform that has it.
 * Delete this file and call the contract directly once that release is pinned;
 * `performActionFailure.ts` then flags any failure reason it adds through its
 * `satisfies never`.
 */
export const performActionContract = {
  ...published,
  input: published.input.extend({
    withScreenshot: z
      .boolean()
      .optional()
      .describe(
        "Also answer with a screenshot taken after the action, once the screen has changed or half a second has passed.",
      ),
  }),
  output: z.discriminatedUnion("outcome", [
    z.object({
      imageJpegBase64: screenshotAfterAction,
      outcome: z.literal("success"),
    }),
    z.discriminatedUnion("failureReason", [
      publishedFailure.options[0].extend({
        imageJpegBase64: screenshotAfterAction,
      }),
      publishedFailure.options[1],
    ]),
  ]),
} as const;
