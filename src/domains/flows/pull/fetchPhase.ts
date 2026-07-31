import type { AuthCommandContext } from "~/shell/commandContext.js";
import { flowsMessages } from "~/core/messages/index.js";

type FetchedBundle = {
  tmpArchive: string;
  bundleFetchedAt: Date;
  envVars: Record<string, string>;
  envVarsFetchedAt: Date;
};

export async function fetchBundleAndEnvVars(
  ctx: AuthCommandContext,
  envId: string,
): Promise<FetchedBundle> {
  const { platformClient } = ctx;
  let tmpArchive: string | undefined;
  let bundleFetchedAt: Date | undefined;
  let envVars: Record<string, string> | undefined;
  let envVarsFetchedAt: Date | undefined;

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
  return { tmpArchive, bundleFetchedAt, envVars, envVarsFetchedAt };
}
