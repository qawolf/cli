import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import type { z } from "zod";

import { environmentsMessages } from "~/core/messages/index.js";
import { pluralize } from "~/core/pluralize.js";
import type { PlatformResult } from "~/shell/platform/requestWithRetry.js";
import type { UI } from "~/shell/ui/index.js";

const findContract = publicContractsV1.environment.find;

type FindOutput = z.output<typeof findContract.output>;
type Environment = FindOutput["environments"][number];

export type ResolveEnvironmentOutcome =
  | { kind: "resolved"; env: string }
  | { kind: "cancelled" }
  | { kind: "error"; error: string };

// The concrete instantiation of PlatformClient["callPublicApi"] this domain
// needs. The real generic method is assignable to it, and test fakes can
// satisfy it without casts.
type FindEnvironmentsApi = (
  contract: typeof findContract,
  input: z.input<typeof findContract.input>,
) => Promise<PlatformResult<FindOutput>>;

export type ResolveEnvironmentDeps = {
  platformClient: { callPublicApi: FindEnvironmentsApi };
  ui: Pick<UI, "mode" | "info" | "select">;
  env: Record<string, string | undefined>;
};

type ResolveEnvironmentOpts = {
  explicit: string | undefined;
  // Command-specific "--env is required" text, shown when resolution is
  // impossible without a prompt (JSON/agent mode).
  requiredMessage: string;
};

export async function resolveEnvironment(
  deps: ResolveEnvironmentDeps,
  opts: ResolveEnvironmentOpts,
): Promise<ResolveEnvironmentOutcome> {
  const explicit = opts.explicit?.trim();
  if (explicit) return { kind: "resolved", env: explicit };

  const fromEnvVar = deps.env["QAWOLF_ENVIRONMENT"]?.trim();
  if (fromEnvVar) {
    deps.ui.info(environmentsMessages.usingFromEnvVar(fromEnvVar));
    return { kind: "resolved", env: fromEnvVar };
  }

  if (deps.ui.mode !== "human") {
    return { kind: "error", error: opts.requiredMessage };
  }

  const fetched = await fetchAllEnvironments(deps.platformClient);
  if (!fetched.ok) return { kind: "error", error: fetched.error };

  const environments = fetched.environments;
  if (environments.length === 0) {
    return { kind: "error", error: environmentsMessages.noEnvironments };
  }
  const sole = environments.length === 1 ? environments[0] : undefined;
  if (sole) {
    deps.ui.info(environmentsMessages.usingEnvironment(sole.name));
    return { kind: "resolved", env: sole.id };
  }

  const narrowed = await narrowByKind(deps.ui, environments);
  if (narrowed === "cancelled") return { kind: "cancelled" };

  const soleOfKind = narrowed.length === 1 ? narrowed[0] : undefined;
  if (soleOfKind) {
    deps.ui.info(environmentsMessages.usingEnvironment(soleOfKind.name));
    return { kind: "resolved", env: soleOfKind.id };
  }

  const picked = await deps.ui.select(
    environmentsMessages.whichEnvironment,
    narrowed.map((e) => ({
      value: e.id,
      label: e.name,
      hint: `${e.kind} · ${e.status}`,
    })),
  );
  if (!picked.ok) return { kind: "cancelled" };
  // Only after a real prompt: teach the way to skip it next time. Auto-picks
  // and env-var resolutions had no friction worth a tip.
  deps.ui.info(environmentsMessages.exportHint(picked.value));
  return { kind: "resolved", env: picked.value };
}

// Large teams accumulate many ephemeral preview (PR) environments that
// drown out the handful of static ones, so when both kinds exist the user
// picks a kind before scrolling a list. Single-kind teams skip this step.
async function narrowByKind(
  ui: ResolveEnvironmentDeps["ui"],
  environments: Environment[],
): Promise<Environment[] | "cancelled"> {
  const byKind = (kind: Environment["kind"]) =>
    environments.filter((e) => e.kind === kind);
  const statics = byKind("static");
  const previews = byKind("preview");
  if (statics.length === 0 || previews.length === 0) return environments;

  const countHint = (list: Environment[]) =>
    pluralize(list.length, "environment");
  const picked = await ui.select(environmentsMessages.whichKind, [
    {
      value: "static",
      label: environmentsMessages.kindLabels.static,
      hint: countHint(statics),
    },
    {
      value: "preview",
      label: environmentsMessages.kindLabels.preview,
      hint: countHint(previews),
    },
  ]);
  if (!picked.ok) return "cancelled";
  return picked.value === "static" ? statics : previews;
}

async function fetchAllEnvironments(platformClient: {
  callPublicApi: FindEnvironmentsApi;
}): Promise<
  { ok: true; environments: Environment[] } | { ok: false; error: string }
> {
  const environments: Environment[] = [];
  let cursor: string | undefined;
  do {
    const result = await platformClient.callPublicApi(findContract, {
      limit: 100,
      cursor,
    });
    if (!result.ok) return result;
    environments.push(...result.value.environments);
    cursor = result.value.nextCursor;
  } while (cursor !== undefined);
  return { ok: true, environments };
}
