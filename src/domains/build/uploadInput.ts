import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { describeFetchCause } from "~/core/fetchCause.js";
import { buildMessages } from "~/core/messages/index.js";
import type { WireError } from "~/shell/platform/createTrpcClient.js";

export type BuildUploadOptions = {
  branch: string | undefined;
  commitSha: string | undefined;
  environmentBaseEphemeralEnvironment: string | undefined;
  environmentEphemeral: boolean | undefined;
  environmentId: string | undefined;
  environmentName: string | undefined;
  filePath: string;
  workspaceId: string | undefined;
};

const definedOnly = <T extends Record<string, unknown>>(fields: T) =>
  Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );

// Every environment flag is passed through, so the contract itself refuses a
// mix of id and name rather than one of them being dropped.
function environmentSelector(options: BuildUploadOptions) {
  const environment = definedOnly({
    baseEphemeralEnvironment: options.environmentBaseEphemeralEnvironment,
    ephemeral: options.environmentEphemeral,
    id: options.environmentId,
    name: options.environmentName,
  });
  return Object.keys(environment).length === 0 ? {} : { environment };
}

export function describePutFailure(error: WireError): string {
  if (error.kind === "http") return buildMessages.storageRefused(error.status);
  if (error.kind === "timeout")
    return buildMessages.storageTimedOut(error.timeoutMs);
  return buildMessages.storageUnreachable(
    error.kind === "network" ? describeFetchCause(error.cause) : undefined,
  );
}

// The build id exists only after the upload, and zod cannot omit a field from a
// refined schema. So the flags are checked against the full input, minus the
// issue for the missing id. Zod skips cross-field refinements on an incomplete
// input, so those are checked again once the id is known.
export function flagProblemsBeforeUpload(
  fields: Record<string, unknown>,
): z.ZodError | undefined {
  const parsed = publicContractsV1.build.create.input.safeParse(fields);
  if (parsed.success) return undefined;
  const issues = parsed.error.issues.filter(
    (issue) => issue.path[0] !== "buildId",
  );
  return issues.length === 0 ? undefined : new z.ZodError(issues);
}

/** The `build.create` fields the flags give, without the build id. */
export const createFields = (options: BuildUploadOptions) =>
  definedOnly({
    branch: options.branch,
    commitSha: options.commitSha,
    workspaceId: options.workspaceId,
    ...environmentSelector(options),
  });

export const requestUploadFields = (options: {
  fileName: string;
  fileSizeBytes: number;
  workspaceId: string | undefined;
}) => definedOnly(options);
