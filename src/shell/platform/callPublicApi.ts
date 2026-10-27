import { type PublicApiContractKind } from "@qawolf/api-contracts/v1";
import type { z } from "zod";

import { errorCode } from "~/core/errors.js";
import { authMessages } from "~/core/messages/index.js";
import { notFoundSubject } from "~/core/publicApi/notFoundSubject.js";

import { applyWorkspaceId } from "./applyWorkspaceId.js";
import { describeRequestError } from "./describeErrors.js";
import type {
  RequestOptions,
  TrpcClient,
  WireError,
  WireResult,
} from "./createTrpcClient.js";
import { type PlatformResult, requestWithRetry } from "./requestWithRetry.js";

// Structural view of a public API contract, parameterized by the wire
// input/output types. Being generic over the whole contract instead would
// widen `contract.output` to its constraint (TypeScript resolves indexed
// accesses on a generic to the constraint), forcing a cast to recover the
// output type.
export type PublicApiContractOf<Input, Output> = {
  kind: PublicApiContractKind;
  name: string;
  input: z.ZodType<unknown, Input>;
  output: z.ZodType<Output>;
};

// Calls a public API contract endpoint. The public contract router is
// mounted under the `public` tRPC namespace, and contract names are the
// route paths below it.
export function callPublicApi<Input, Output>(
  trpc: TrpcClient,
  contract: PublicApiContractOf<Input, Output>,
  input: Input,
  options?: RequestOptions,
): Promise<WireResult<Output>> {
  const path = `public.${contract.name}`;
  if (contract.kind === "read") {
    return trpc.query(path, input, contract.output, options);
  }
  return trpc.mutation(path, input, contract.output, options);
}

export type CallPublicApiMethod = <Input, Output>(
  contract: PublicApiContractOf<Input, Output>,
  input: Input,
  options?: RequestOptions,
) => Promise<PlatformResult<Output>>;

// Fetch failures from before a connection opens, so nothing was sent. A reset
// can come after the body was written, so it is not here.
const notSentCodes = new Set([
  "ConnectionRefused",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ENOTFOUND",
  "UND_ERR_CONNECT_TIMEOUT",
]);

function wasNeverSent(err: WireError): boolean {
  if (err.kind !== "network") return false;
  // Node's fetch puts the code on the error's cause, Bun's on the error.
  const code = errorCode(err.cause.cause) ?? errorCode(err.cause);
  return code !== undefined && notSentCodes.has(code);
}

type MethodDeps = {
  baseUrl: string;
  sleep?: ((ms: number) => Promise<void>) | undefined;
  /** Workspace the session chose, sent on routes that accept one. */
  workspaceId?: string | undefined;
};

// Builds the PlatformClient method: reads retry on transient network
// errors, writes only when nothing was sent — they are not idempotent, and a
// retried request that reached the server the first time would repeat the
// action.
export function makeCallPublicApiMethod(
  trpc: TrpcClient,
  deps: MethodDeps,
  backoffMs: readonly number[],
): CallPublicApiMethod {
  return async (contract, input, options) => {
    const sent = applyWorkspaceId(contract.input, input, deps.workspaceId);
    // Read from the request rather than from the reply, so a 404 names what was
    // asked for even when the platform answers a bare "Not found".
    const subject = notFoundSubject(contract.name, sent);
    return requestWithRetry({
      call: () => callPublicApi(trpc, contract, sent, options),
      backoffMs,
      ...(contract.kind === "write" ? { retryable: wasNeverSent } : {}),
      describe: (err) => {
        const failure = describeRequestError(
          err,
          deps.baseUrl,
          contract.name,
          subject,
        );
        // Only a write: a read can fail inside a command that already changed
        // something, as `runner run --follow` polls after submitting.
        if (contract.kind !== "write" || !wasNeverSent(err)) return failure;
        return {
          ...failure,
          error: `${failure.error} ${authMessages.errors.request.notSent}`,
          mayHaveArrived: false,
        };
      },
      sleep: deps.sleep,
    });
  };
}
