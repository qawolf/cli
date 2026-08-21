import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

/**
 * The runner-image enum the platform is migrating: production still speaks the
 * old names (which the published api-contracts also encodes), staging already
 * speaks the new ones. The CLI has to work against both while the migration
 * runs, and no one server accepts both — so the client-side validation and the
 * response parse both allow either form, and the wire request carries whatever
 * the caller chose. When the platform reaches a single vocabulary this module
 * collapses onto it and the runner code goes back to `publicContractsV1`.
 */
const oldRunnerNames = [
  "node20Basic",
  "node20WithPlaywright",
  "node20WithAndroid",
  "node20WithIos",
] as const;

const newRunnerNames = ["basic", "playwright", "android", "ios"] as const;

export type RunnerName =
  | (typeof oldRunnerNames)[number]
  | (typeof newRunnerNames)[number];

export const compatRunnerNameSchema = z.enum([
  ...oldRunnerNames,
  ...newRunnerNames,
]);

/**
 * runner.launch, with the runner-name validation on request and response
 * widened to accept both vocabularies. Everything else — name, kind,
 * description — is unchanged; the wire path is still `public.runner.launch`.
 */
export const compatLaunchContract = {
  ...publicContractsV1.runner.launch,
  input: z.object({
    id: z.string(),
    runnerName: compatRunnerNameSchema.optional(),
  }),
  output: z.object({
    gpuAccelerated: z.boolean(),
    id: z.string(),
    outcome: z.enum(["launched", "already-running"]),
    runnerName: compatRunnerNameSchema,
  }),
};

/**
 * runner.runFlow, with the two runner-name fields in the mismatch outcome
 * widened. The other outcomes carry no runner-name fields, so they are
 * restated here verbatim.
 */
export const compatRunFlowContract = {
  ...publicContractsV1.runner.runFlow,
  output: z.discriminatedUnion("outcome", [
    z.object({ outcome: z.literal("submitted"), runId: z.string() }),
    z.object({ outcome: z.literal("runner-unreachable") }),
    z.object({
      outcome: z.literal("runner-target-mismatch"),
      requiredRunnerName: compatRunnerNameSchema,
      runnerName: compatRunnerNameSchema,
    }),
  ]),
};
