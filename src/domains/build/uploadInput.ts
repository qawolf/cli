import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import type { z } from "zod";

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

const storageReasonMaxLength = 200;

// GCS and S3 answer with XML that names the cause, such as ExpiredToken or
// SignatureDoesNotMatch.
function storageReason(body: string): string | undefined {
  const code = /<Code>([^<]+)<\/Code>/.exec(body)?.[1];
  const message = /<Message>([^<]+)<\/Message>/.exec(body)?.[1];
  const reason =
    code === undefined
      ? body.replace(/\s+/g, " ").trim()
      : [code, message].filter((part) => part !== undefined).join(": ");
  if (reason.length === 0) return undefined;
  return reason.length > storageReasonMaxLength
    ? `${reason.slice(0, storageReasonMaxLength)}…`
    : reason;
}

export function describePutFailure(error: WireError): string {
  if (error.kind === "http")
    return buildMessages.storageRefused(
      error.status,
      storageReason(error.body),
    );
  if (error.kind === "timeout")
    return buildMessages.storageTimedOut(error.timeoutMs);
  return buildMessages.storageUnreachable(
    error.kind === "network" ? describeFetchCause(error.cause) : undefined,
  );
}

type CreateInput = z.output<typeof publicContractsV1.build.create.input>;
export type CreateFlags = Omit<CreateInput, "buildId">;

// The build id exists only after the upload, and zod cannot omit a field from
// a refined schema. A well-formed id that is never sent lets every rule,
// cross-field ones included, check the flags before the upload.
const idForFlagCheck = "000000000000000000000000obld";

/** Checks the `build.create` flags before anything is sent. */
export function parseCreateFlags(
  options: BuildUploadOptions,
): { ok: true; value: CreateFlags } | { ok: false; error: z.ZodError } {
  const parsed = publicContractsV1.build.create.input.safeParse({
    ...definedOnly({
      branch: options.branch,
      commitSha: options.commitSha,
      workspaceId: options.workspaceId,
    }),
    ...environmentSelector(options),
    buildId: idForFlagCheck,
  });
  if (!parsed.success) return { ok: false, error: parsed.error };
  const { buildId: _idForFlagCheck, ...flags } = parsed.data;
  return { ok: true, value: flags };
}

export const requestUploadFields = (options: {
  fileName: string;
  fileSizeBytes: number;
  workspaceId: string | undefined;
}) => definedOnly(options);
