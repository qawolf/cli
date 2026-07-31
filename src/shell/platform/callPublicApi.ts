import { type PublicApiContractKind } from "@qawolf/api-contracts/v1";
import type { z } from "zod";

import { describeRequestError } from "./describeErrors.js";
import type {
  RequestOptions,
  TrpcClient,
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

type MethodDeps = {
  baseUrl: string;
  sleep?: ((ms: number) => Promise<void>) | undefined;
};

// Builds the PlatformClient method: reads retry on transient network
// errors, writes never retry — they are not idempotent, and a retried
// request that reached the server the first time would repeat the action.
export function makeCallPublicApiMethod(
  trpc: TrpcClient,
  deps: MethodDeps,
  readBackoffMs: readonly number[],
): CallPublicApiMethod {
  return async (contract, input, options) =>
    requestWithRetry({
      call: () => callPublicApi(trpc, contract, input, options),
      backoffMs: contract.kind === "read" ? readBackoffMs : [],
      describe: (err) => describeRequestError(err, deps.baseUrl, contract.name),
      sleep: deps.sleep,
    });
}
