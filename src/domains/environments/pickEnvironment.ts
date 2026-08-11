import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import type { z } from "zod";

import { environmentsMessages } from "~/core/messages/index.js";
import { pluralize } from "~/core/pluralize.js";
import {
  failureFields,
  type PlatformError,
} from "~/shell/platform/requestWithRetry.js";
import type {
  ResolveEnvironmentDeps,
  ResolveEnvironmentOutcome,
} from "./resolveEnvironment.js";

const findContract = publicContractsV1.environment.find;

type FindOutput = z.output<typeof findContract.output>;
type Environment = FindOutput["environments"][number];

// The interactive tail of environment resolution: list the team's
// environments and auto-pick or prompt. Only reached in human mode when
// neither --env nor QAWOLF_ENVIRONMENT is set.
export async function pickEnvironment(
  deps: ResolveEnvironmentDeps,
): Promise<ResolveEnvironmentOutcome> {
  const fetched = await fetchAllEnvironments(deps.platformClient);
  if (!fetched.ok) return { ...failureFields(fetched), kind: "error" };

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

// Termination depends on a server-controlled cursor, so the loop is
// bounded: a pagination bug must produce an error, not a hung CLI. Ten
// pages (1,000 environments) is an order of magnitude above any observed
// team while keeping the pathological case to seconds, not minutes.
const maxPages = 10;

async function fetchAllEnvironments(
  platformClient: ResolveEnvironmentDeps["platformClient"],
): Promise<
  { ok: true; environments: Environment[] } | ({ ok: false } & PlatformError)
> {
  const environments: Environment[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await platformClient.callPublicApi(findContract, {
      limit: 100,
      cursor,
    });
    if (!result.ok) return result;
    environments.push(...result.value.environments);
    cursor = result.value.nextCursor;
    if (cursor === undefined) return { ok: true, environments };
  }
  return { ok: false, error: environmentsMessages.tooManyPages(maxPages) };
}
