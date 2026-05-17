import type { CommandContext } from "~/lib/context.js";
import { requestEnvVars } from "./envVars.js";
import { downloadBundle, requestBundle } from "./pull.js";

type FetchedBundle = {
  tmpArchive: string;
  bundleFetchedAt: Date;
  envVars: Record<string, string>;
  envVarsFetchedAt: Date;
};

export async function fetchBundleAndEnvVars(
  ctx: CommandContext,
  envId: string,
  apiKey: string,
  fetch: typeof globalThis.fetch,
): Promise<FetchedBundle> {
  const deps = { apiKey, baseUrl: ctx.apiBaseUrl, fetch };
  let signedUrl: string | undefined;
  let tmpArchive: string | undefined;
  let bundleFetchedAt: Date | undefined;
  let envVars: Record<string, string> | undefined;
  let envVarsFetchedAt: Date | undefined;

  await ctx.ui.withProgress(
    [
      {
        message: "Resolving flows bundle download URL",
        task: async () => {
          signedUrl = (await requestBundle(deps, envId)).signedUrl;
        },
      },
      {
        message: "Downloading flows bundle",
        task: async () => {
          if (signedUrl === undefined) {
            throw new Error("internal: signedUrl not set");
          }
          tmpArchive = (await downloadBundle({ fetch }, signedUrl)).tmpArchive;
          bundleFetchedAt = new Date();
        },
      },
      {
        message: "Fetching environment variables",
        task: async () => {
          envVars = await requestEnvVars(deps, envId);
          envVarsFetchedAt = new Date();
        },
      },
    ],
    "Downloaded flows bundle and environment variables",
  );

  if (
    tmpArchive === undefined ||
    bundleFetchedAt === undefined ||
    envVars === undefined ||
    envVarsFetchedAt === undefined
  ) {
    throw new Error("internal: fetch phase did not populate all results");
  }
  return { tmpArchive, bundleFetchedAt, envVars, envVarsFetchedAt };
}
