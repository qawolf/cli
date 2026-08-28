import type { RunFiles, RunSelection } from "@qawolf/api-contracts/v1";

import {
  buildRunFileDelta,
  toRunFilesManifest,
} from "~/core/interactiveRunner/fileDelta.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type { AuthCommandContext } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import type { ResolvedRunner } from "./resolveRunner.js";
import type { RunSubmitRefusal } from "./runSubmitFailure.js";
import { type SendResult, sendRunFlowRequest } from "./sendRunFlowRequest.js";

type FileSync = "delta" | "full";

export type SubmittedRun =
  | {
      ok: true;
      bootstrappedRunner: boolean;
      fileSync: FileSync;
      runId: string;
    }
  | ({ ok: false } & RunSubmitRefusal);

type Runner = Extract<ResolvedRunner, { type: "launched" | "resolved" }>;

export async function submitRun(
  ctx: AuthCommandContext,
  options: {
    entryPointPath: string;
    environment: Record<string, string> | undefined;
    environmentId: string | undefined;
    files: RunFiles;
    resolved: Runner;
    selection: RunSelection | undefined;
  },
  deps: InteractiveRunnerDeps,
): Promise<SubmittedRun> {
  // A runner the CLI just started holds nothing worth claiming a baseline from.
  const held =
    options.resolved.type === "launched"
      ? undefined
      : await deps.runFilesManifest.read().catch(() => undefined);

  const delta = buildRunFileDelta({
    entryPointPath: options.entryPointPath,
    files: options.files,
    held,
    runnerId: options.resolved.runnerId,
    selectionPath: options.selection?.path,
  });

  const first = await sendRunFlowRequest(ctx, options, delta);
  if (first.type === "needs-full-sync") {
    // Bounded to one. The runner cannot answer this to a request that already
    // carries every file, so a second miss is something else and should surface.
    const retried = await sendRunFlowRequest(ctx, options, {
      files: options.files,
      unchangedFiles: undefined,
    });
    return finish(retried, "full", options, deps);
  }
  return finish(
    first,
    delta.unchangedFiles === undefined ? "full" : "delta",
    options,
    deps,
  );
}

async function finish(
  sent: SendResult,
  fileSync: FileSync,
  options: { files: RunFiles; resolved: Runner },
  deps: InteractiveRunnerDeps,
): Promise<SubmittedRun> {
  if (sent.type === "failed") return { ...sent.failure, ok: false };
  if (sent.type === "needs-full-sync") {
    return {
      error: interactiveRunnerMessages.fullSyncTwice,
      exitCode: exitCodes.network,
      ok: false,
    };
  }

  // Only after a success, and never before. An answer that never arrived may or
  // may not have reached the pod, and claiming a baseline it does not hold is
  // the one stale state with no way back.
  await deps.runFilesManifest
    .write(
      toRunFilesManifest({
        files: options.files,
        runnerId: options.resolved.runnerId,
      }),
    )
    .catch(() => undefined);

  return {
    bootstrappedRunner: sent.bootstrappedRunner,
    fileSync,
    ok: true,
    runId: sent.runId,
  };
}
