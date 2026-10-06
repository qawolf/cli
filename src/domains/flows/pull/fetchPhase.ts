import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import type { AuthCommandContext } from "~/shell/commandContext.js";
import { flowsMessages } from "~/core/messages/index.js";

import type { FetchedTags } from "./bundle.js";

type FetchedBundle = {
  tmpArchive: string;
  bundleFetchedAt: Date;
  envVars: Record<string, string>;
  envVarsFetchedAt: Date;
  /** The team that owns the environment; its storage holds the flows' assets. */
  teamId: string;
  // Undefined when the tag fetch did not succeed. Tags enrich a pull; they are
  // never a precondition for one, so a failure here leaves the pull intact.
  tags: FetchedTags | undefined;
  // From the same listing as the tags, and missing whenever they are.
  flowIds: ReadonlyMap<string, string> | undefined;
};

type FetchedListing = { tags: FetchedTags; flowIds: Map<string, string> };

// Drafts are included so the cache covers every flow the bundle can contain;
// a flow missing from the response keeps unknown tags rather than empty ones.
async function fetchListing(
  ctx: AuthCommandContext,
  envId: string,
): Promise<FetchedListing | undefined> {
  try {
    const result = await ctx.platformClient.callPublicApi(
      publicContractsV1.flow.list,
      { environmentId: envId, includeDrafts: true },
    );
    if (!result.ok) return undefined;
    return {
      tags: {
        fetchedAt: new Date(),
        byPath: new Map(result.value.flows.map((f) => [f.path, [...f.tags]])),
      },
      // Kept so a pulled flow can be named by id offline, as --remote does.
      flowIds: new Map(result.value.flows.map((f) => [f.path, f.flowId])),
    };
  } catch {
    return undefined;
  }
}

export async function fetchBundleAndEnvVars(
  ctx: AuthCommandContext,
  envId: string,
): Promise<FetchedBundle> {
  const { platformClient } = ctx;
  let tmpArchive: string | undefined;
  let bundleFetchedAt: Date | undefined;
  let envVars: Record<string, string> | undefined;
  let envVarsFetchedAt: Date | undefined;
  let teamId: string | undefined;
  let listing: FetchedListing | undefined;

  await ctx.ui.withProgress(
    [
      {
        message: flowsMessages.pull.downloadingBundle,
        task: async () => {
          const result = await platformClient.downloadBundle(envId);
          if (!result.ok) throw new Error(result.error);
          tmpArchive = result.value.tmpArchive;
          bundleFetchedAt = new Date();
        },
      },
      {
        message: flowsMessages.pull.fetchingEnvVars,
        task: async () => {
          const result =
            await platformClient.getEnvironmentWithVariables(envId);
          if (!result.ok) throw new Error(result.error);
          envVars = result.value.environmentVariables;
          teamId = result.value.teamId;
          envVarsFetchedAt = new Date();
        },
      },
      {
        message: flowsMessages.pull.fetchingTags,
        task: async () => {
          listing = await fetchListing(ctx, envId);
        },
      },
    ],
    flowsMessages.pull.downloadComplete,
  );

  if (
    tmpArchive === undefined ||
    bundleFetchedAt === undefined ||
    envVars === undefined ||
    envVarsFetchedAt === undefined ||
    teamId === undefined
  ) {
    throw new Error(
      "Unexpected state: the bundle and env vars were not fetched. " +
        "This is a bug - please report it at https://github.com/qawolf/cli/issues",
    );
  }
  return {
    tmpArchive,
    bundleFetchedAt,
    envVars,
    envVarsFetchedAt,
    teamId,
    tags: listing?.tags,
    flowIds: listing?.flowIds,
  };
}
