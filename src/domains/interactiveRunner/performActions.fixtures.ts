import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import type { handleRunnerActions, SequenceAnswer } from "./performActions.js";

type ActionsOptions = Parameters<typeof handleRunnerActions>[1];

export const aClick = { button: "left", type: "click", x: 480, y: 260 };
export const someTyping = { text: "hello@example.com", type: "type" };
export const anEnter = { keys: ["Enter"], type: "keypress" };
export const sequence = JSON.stringify([aClick, someTyping, anEnter]);

export const performed = (index: number) => ({
  effect: "performed",
  index,
  outcome: "success",
});

/** Long enough to carry the start-of-image marker the writer checks for. */
export const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString(
  "base64",
);

/** The three-action sequence against a named runner, with no frame asked for. */
export function actionsOptions(
  overrides: Partial<ActionsOptions> = {},
): ActionsOptions {
  return {
    actions: sequence,
    continueOnFailure: false,
    runner: "ci",
    screenshot: undefined,
    screenshotMode: undefined,
    ...overrides,
  };
}

/**
 * A mock answer admitted by the published schema, so a contract the platform
 * has changed fails here rather than passing as a shape nothing sends.
 */
export function sequenceAnswer(value: unknown): SequenceAnswer {
  return publicContractsV1.runner.performActions.output.parse(value);
}
