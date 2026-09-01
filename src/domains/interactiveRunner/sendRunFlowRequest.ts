import {
  type RunFiles,
  type RunSelection,
  publicContractsV1,
} from "@qawolf/api-contracts/v1";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type { AuthCommandContext } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import type { ResolvedRunner } from "./resolveRunner.js";
import { runnerCallOptions } from "./runnerCallOptions.js";
import {
  type RunSubmitRefusal,
  describeRunSubmitFailure,
} from "./runSubmitFailure.js";

type Runner = Extract<ResolvedRunner, { type: "launched" | "resolved" }>;

export type SendResult =
  | { type: "submitted"; bootstrappedRunner: boolean; runId: string }
  | { type: "needs-full-sync" }
  | { type: "failed"; failure: RunSubmitRefusal };

export async function sendRunFlowRequest(
  ctx: AuthCommandContext,
  options: {
    entryPointPath: string;
    environment: Record<string, string> | undefined;
    environmentId: string | undefined;
    resolved: Runner;
    selection: RunSelection | undefined;
  },
  delta: {
    files: RunFiles;
    unchangedFiles: Record<string, string> | undefined;
  },
): Promise<SendResult> {
  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.runFlow,
    {
      entryPointPath: options.entryPointPath,
      files: delta.files,
      id: options.resolved.runnerId,
      ...(options.environment === undefined
        ? {}
        : { env: options.environment }),
      ...(options.environmentId === undefined
        ? {}
        : { environmentId: options.environmentId }),
      ...(options.selection === undefined
        ? {}
        : { selection: options.selection }),
      ...(delta.unchangedFiles === undefined
        ? {}
        : { unchangedFiles: delta.unchangedFiles }),
    },
    runnerCallOptions,
  );
  if (!result.ok) {
    return {
      failure: {
        ...failureFields(result),
        exitCode: result.exitCode ?? exitCodes.network,
      },
      type: "failed",
    };
  }

  const { outcome } = result.value;
  switch (outcome) {
    case "failure":
      return result.value.failureReason === "needs-full-sync"
        ? { type: "needs-full-sync" }
        : { failure: describeRunSubmitFailure(result.value), type: "failed" };
    case "success":
      return {
        bootstrappedRunner: result.value.bootstrappedRunner === true,
        runId: result.value.runId,
        type: "submitted",
      };
    // An outcome added to the contract must not fall through to exit 0. Today
    // the response schema refuses one this version does not know, and this keeps
    // a future contracts bump a compile error rather than a silent pass.
    default:
      outcome satisfies never;
      return {
        failure: {
          error: interactiveRunnerMessages.runSubmitAnsweredUnknown(outcome),
          exitCode: exitCodes.network,
        },
        type: "failed",
      };
  }
}
