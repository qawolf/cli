import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import type { AuthCommandContext } from "~/shell/commandContext.js";
import { flowsMessages } from "~/core/messages/index.js";

import type { FetchedTags } from "./bundle.js";

type FetchedBundle = {
  tmpArchive: string;
  bundleFetchedAt: Date;
  envVars: Record<string, string>;
  envVarsFetchedAt: Date;
  // Undefined when the tag fetch did not succeed. Tags enrich a pull; they are
  // never a precondition for one, so a failure here leaves the pull intact.
  tags: FetchedTags | undefined;
};

// Drafts are included so the cache covers every flow the bundle can contain;
// a flow missing from the response keeps unknown tags rather than empty ones.
async function fetchTags(
  ctx: AuthCommandContext,
  envId: string,
): Promise<FetchedTags | undefined> {
  try {
    const result = await ctx.platformClient.callPublicApi(
      publicContractsV1.flow.list,
      { environmentId: envId, includeDrafts: true },
    );
    if (!result.ok) return undefined;
    return {
      fetchedAt: new Date(),
      byPath: new Map(result.value.flows.map((f) => [f.path, [...f.tags]])),
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
  let tags: FetchedTags | undefined;

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
          const result = await platformClient.getEnvVars(envId);
          if (!result.ok) throw new Error(result.error);
          envVars = result.value;
          envVarsFetchedAt = new Date();
        },
      },
      {
        message: flowsMessages.pull.fetchingTags,
        task: async () => {
          tags = await fetchTags(ctx, envId);
        },
      },
    ],
    flowsMessages.pull.downloadComplete,
  );

  if (
    tmpArchive === undefined ||
    bundleFetchedAt === undefined ||
    envVars === undefined ||
    envVarsFetchedAt === undefined
  ) {
    throw new Error(
      "Unexpected state: the bundle and env vars were not fetched. " +
        "This is a bug - please report it at https://github.com/qawolf/cli/issues",
    );
  }
  return { tmpArchive, bundleFetchedAt, envVars, envVarsFetchedAt, tags };
}
