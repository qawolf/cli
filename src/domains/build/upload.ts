import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { buildMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import type { WireResult } from "~/shell/platform/createTrpcClient.js";
import {
  failureFields,
  type PlatformFailure,
} from "~/shell/platform/requestWithRetry.js";

import { uploadFileName } from "./uploadFileName.js";
import {
  type BuildUploadOptions,
  describePutFailure,
  parseCreateFlags,
  requestUploadFields,
} from "./uploadInput.js";

export type { BuildUploadOptions } from "./uploadInput.js";

export type BuildUploadDeps = {
  openFile: (path: string) => Promise<Blob | undefined>;
  putFile: (args: {
    body: Blob;
    headers: Record<string, string>;
    url: string;
  }) => Promise<WireResult<void>>;
};

// Only a platform that never answered is a network failure. A refusal keeps the
// exit code the generated build commands give it.
const platformFailure = (failure: PlatformFailure): CommandResult => ({
  ...(failure.unreachable === true ? { exitCode: exitCodes.network } : {}),
  ...failureFields(failure),
});

const invalid = (error: z.ZodError): CommandResult => ({
  error: z.prettifyError(error),
  exitCode: exitCodes.invalidArgs,
});

/**
 * Uploads a local app file as a build: asks for a create-only upload URL,
 * streams the file there, then creates the build, which reads the app id and
 * version from the file. The flags and the file are checked before anything
 * is sent, so a bad flag does not leave an uploaded file behind.
 */
export async function handleBuildUpload(
  ctx: AuthCommandContext,
  options: BuildUploadOptions,
  deps: BuildUploadDeps,
): Promise<CommandResult> {
  const flags = parseCreateFlags(options);
  if (!flags.ok) return invalid(flags.error);

  const file = await deps.openFile(options.filePath);
  if (file === undefined) {
    return {
      error: buildMessages.fileUnreadable(options.filePath),
      exitCode: exitCodes.invalidArgs,
    };
  }
  const fileName = uploadFileName(options.filePath);
  const requestInput = publicContractsV1.build.requestUpload.input.safeParse(
    requestUploadFields({
      fileName,
      fileSizeBytes: file.size,
      workspaceId: options.workspaceId,
    }),
  );
  if (!requestInput.success) return invalid(requestInput.error);

  const requested = await ctx.platformClient.callPublicApi(
    publicContractsV1.build.requestUpload,
    requestInput.data,
  );
  if (!requested.ok) return platformFailure(requested);
  const { buildId, uploadHeaders, uploadUrl } = requested.value;

  const waiting = ctx.ui.wait(buildMessages.uploading(fileName, file.size));
  const uploaded = await deps.putFile({
    body: file,
    headers: uploadHeaders,
    url: uploadUrl,
  });
  waiting.stop();
  if (!uploaded.ok) {
    return {
      error: buildMessages.uploadFailed(
        buildId,
        describePutFailure(uploaded.error),
      ),
      exitCode: exitCodes.network,
    };
  }

  const created = await ctx.platformClient.callPublicApi(
    publicContractsV1.build.create,
    { ...flags.value, buildId },
  );
  if (!created.ok) {
    return {
      ...platformFailure(created),
      error: buildMessages.createFailed(buildId, created.error),
    };
  }

  const { build } = created.value;
  ctx.ui.output(build, buildMessages.uploaded(build));
  return undefined;
}
