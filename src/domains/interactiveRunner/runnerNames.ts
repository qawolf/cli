import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

/**
 * The runner-image enum the platform speaks. The published api-contracts still
 * encodes the pre-rename vocabulary (`node20Basic`, `node20WithPlaywright`,
 * `node20WithAndroid`, `node20WithIos`), so the schemas are restated here in
 * the current one. When the published contract catches up this module deletes
 * and the runner code goes back to `publicContractsV1`.
 */
const runnerNames = ["basic", "playwright", "android", "ios"] as const;

export type RunnerName = (typeof runnerNames)[number];

export const runnerNameSchema = z.enum(runnerNames);

/**
 * runner.launch, with the runner-name validation on request and response
 * restated in the current vocabulary. Everything else — path, kind,
 * description — comes through from the published contract unchanged.
 */
export const launchContract = {
  ...publicContractsV1.runner.launch,
  input: z.object({
    id: z.string(),
    runnerName: runnerNameSchema.optional(),
  }),
  output: z.object({
    gpuAccelerated: z.boolean(),
    id: z.string(),
    outcome: z.enum(["launched", "already-running"]),
    runnerName: runnerNameSchema,
  }),
};

/**
 * runner.runFlow, with the two runner-name fields in the mismatch outcome
 * restated. The other outcomes carry no runner-name fields, so they are
 * restated here verbatim.
 */
export const runFlowContract = {
  ...publicContractsV1.runner.runFlow,
  output: z.discriminatedUnion("outcome", [
    z.object({ outcome: z.literal("submitted"), runId: z.string() }),
    z.object({ outcome: z.literal("runner-unreachable") }),
    z.object({
      outcome: z.literal("runner-target-mismatch"),
      requiredRunnerName: runnerNameSchema,
      runnerName: runnerNameSchema,
    }),
  ]),
};
