import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import type { z } from "zod";

import { environmentsMessages } from "~/core/messages/index.js";
import {
  failureFields,
  type PlatformResult,
} from "~/shell/platform/requestWithRetry.js";
import type { UI } from "~/shell/ui/index.js";
import { pickEnvironment } from "./pickEnvironment.js";

const findContract = publicContractsV1.environment.find;
const getContract = publicContractsV1.environment.get;

type FindOutput = z.output<typeof findContract.output>;
type GetOutput = z.output<typeof getContract.output>;

export type ResolveEnvironmentOutcome =
  | {
      kind: "resolved";
      env: string;
      // Carried so a pull can record which environment a cache directory
      // holds. Absent where the resolution path did not learn them.
      slug?: string | undefined;
      name?: string | undefined;
    }
  | { kind: "cancelled" }
  | {
      kind: "error";
      error: string;
      errorBody?: string;
      /**
       * True when the platform never answered. A definitive refusal (unknown
       * environment, revoked key) is not unreachable: falling back to a
       * pulled copy would then run something the platform said no to.
       */
      unreachable: boolean;
    };

// The concrete instantiations of PlatformClient["callPublicApi"] this domain
// needs. The real generic method is assignable to the overload set, and test
// fakes can satisfy it without casts.
type EnvironmentsApi = {
  (
    contract: typeof findContract,
    input: z.input<typeof findContract.input>,
  ): Promise<PlatformResult<FindOutput>>;
  (
    contract: typeof getContract,
    input: z.input<typeof getContract.input>,
  ): Promise<PlatformResult<GetOutput>>;
};

export type ResolveEnvironmentDeps = {
  platformClient: { callPublicApi: EnvironmentsApi };
  ui: Pick<UI, "mode" | "info" | "select">;
  env: Record<string, string | undefined>;
};

type ResolveEnvironmentOpts = {
  explicit: string | undefined;
  // Command-specific "an environment is required" text, shown when
  // resolution is impossible without a prompt (JSON/agent mode).
  requiredMessage: string;
};

export async function resolveEnvironment(
  deps: ResolveEnvironmentDeps,
  opts: ResolveEnvironmentOpts,
): Promise<ResolveEnvironmentOutcome> {
  const explicit = opts.explicit?.trim();
  if (explicit) return resolveRef(deps, explicit);

  const fromEnvVar = deps.env["QAWOLF_ENVIRONMENT"]?.trim();
  if (fromEnvVar) {
    deps.ui.info(environmentsMessages.usingFromEnvVar(fromEnvVar));
    return resolveRef(deps, fromEnvVar);
  }

  if (deps.ui.mode !== "human") {
    return { kind: "error", error: opts.requiredMessage, unreachable: false };
  }

  return pickEnvironment(deps);
}

// A user-supplied value (--env flag or QAWOLF_ENVIRONMENT) may be an alias.
// environment.get accepts an id or an alias and returns the canonical id, so
// every ref goes through it — pattern-detecting aliases is not possible
// because real ids also match the kebab-case slug pattern. Passing only the
// canonical id downstream keeps cache identity stable: --env <alias> and
// --env <id> land in the same .qawolf/<id>/ directory.
async function resolveRef(
  deps: ResolveEnvironmentDeps,
  ref: string,
): Promise<ResolveEnvironmentOutcome> {
  const result = await deps.platformClient.callPublicApi(getContract, {
    environmentId: ref,
  });
  if (!result.ok) {
    return {
      ...failureFields(result),
      kind: "error",
      error: environmentsMessages.couldNotResolve(ref, result.error),
      unreachable: result.unreachable === true,
    };
  }
  if (result.value.id !== ref) {
    deps.ui.info(environmentsMessages.resolvedAlias(ref, result.value.id));
  }
  return {
    kind: "resolved",
    env: result.value.id,
    slug: result.value.alias ?? undefined,
    name: result.value.name,
  };
}
