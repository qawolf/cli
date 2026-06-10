import {
  type AnyPublicApiContract,
  type PublicApiInput,
  type PublicApiOutput,
} from "@qawolf/api-contracts/v1";
import type { z } from "zod";

import { describeRequestError } from "./describeErrors.js";
import type { TrpcClient, WireResult } from "./createTrpcClient.js";
import { type PlatformResult, requestWithRetry } from "./requestWithRetry.js";

// Calls a public API contract endpoint. The public contract router is
// mounted under the `public` tRPC namespace, and contract names are the
// route paths below it.
export function callPublicApi<Contract extends AnyPublicApiContract>(
  trpc: TrpcClient,
  contract: Contract,
  input: PublicApiInput<Contract>,
): Promise<WireResult<PublicApiOutput<Contract>>> {
  const path = `public.${contract.name}`;
  // The generic can't prove contract.output infers to the contract's output
  // type, so connect the two here once for all callers.
  const outputSchema = contract.output as z.ZodType<PublicApiOutput<Contract>>;
  if (contract.kind === "read") {
    return trpc.query(path, input, outputSchema);
  }
  return trpc.mutation(path, input, outputSchema);
}

export type CallPublicApiMethod = <Contract extends AnyPublicApiContract>(
  contract: Contract,
  input: PublicApiInput<Contract>,
) => Promise<PlatformResult<PublicApiOutput<Contract>>>;

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
  return async (contract, input) =>
    requestWithRetry({
      call: () => callPublicApi(trpc, contract, input),
      backoffMs: contract.kind === "read" ? readBackoffMs : [],
      describe: (err) => describeRequestError(err, deps.baseUrl, contract.name),
      sleep: deps.sleep,
    });
}
