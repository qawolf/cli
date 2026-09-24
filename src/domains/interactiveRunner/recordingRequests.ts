import {
  publicContractsV1,
  type PublicApiInput,
  type RunnerRecordingCommand,
} from "@qawolf/api-contracts/v1";

import type { RunnerApiContext } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import type { TargetedRunner } from "./resolveRunner.js";
import { runnerCallOptions } from "./runnerCallOptions.js";
import { runnerRequestFailure } from "./runnerRequestFailure.js";

export type RecordingQuery = Pick<
  PublicApiInput<typeof publicContractsV1.runner.recordings>,
  "pageToken" | "recordingId"
>;

export async function recordOnRunner(
  ctx: RunnerApiContext,
  runner: TargetedRunner,
  command: RunnerRecordingCommand,
) {
  const contract = publicContractsV1.runner.record;
  const parsed = contract.input.safeParse({ id: runner.runnerId, command });
  if (!parsed.success) {
    return {
      ok: false as const,
      error:
        "Invalid recording request. Runner ids must be valid and recording ids must be UUIDs.",
      exitCode: exitCodes.invalidArgs,
    };
  }
  const result = await ctx.platformClient.callPublicApi(
    contract,
    parsed.data,
    runnerCallOptions,
  );
  return result.ok
    ? result
    : { ok: false as const, ...runnerRequestFailure(result, runner) };
}

export async function readRunnerRecordings(
  ctx: RunnerApiContext,
  runner: TargetedRunner,
  query: RecordingQuery,
) {
  const contract = publicContractsV1.runner.recordings;
  const parsed = contract.input.safeParse({ id: runner.runnerId, ...query });
  if (!parsed.success) {
    return {
      ok: false as const,
      error:
        "Invalid recordings request. Use a valid runner id, a UUID recording id, and a page token of at most 4096 characters.",
      exitCode: exitCodes.invalidArgs,
    };
  }
  // This reads workspace storage. Do not check that the runner is still alive.
  const result = await ctx.platformClient.callPublicApi(contract, parsed.data);
  return result.ok
    ? result
    : { ok: false as const, ...runnerRequestFailure(result, runner) };
}
