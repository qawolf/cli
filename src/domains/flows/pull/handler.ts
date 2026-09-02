import type { Fs } from "~/shell/fs.js";
import { dirname, join, resolve } from "node:path";

import cliPackageJson from "../../../../package.json" with { type: "json" };

import {
  type AuthCommandContext,
  type CommandResult,
} from "~/shell/commandContext.js";
import { flowsMessages } from "~/core/messages/index.js";
import { fetchBundleAndEnvVars } from "./fetchPhase.js";
import { checkSafety, validateEnvId } from "./pull.js";
import { reportPullResult } from "./reportPull.js";
import { stageBundle } from "./stage.js";

export type FlowsPullOptions = {
  readonly env: string;
  /** Alias and display name of the env, recorded so a pulled cache is
   * recognisable without the platform. */
  readonly envSlug?: string | undefined;
  readonly envName?: string | undefined;
  readonly out?: string;
  readonly yes?: boolean;
};

type HandleFlowsPullDeps = {
  readonly flowsVersion: string;
  readonly fs: Fs;
};

export async function handleFlowsPull(
  ctx: AuthCommandContext,
  opts: FlowsPullOptions,
  deps?: HandleFlowsPullDeps,
): Promise<CommandResult> {
  const resolvedDeps: HandleFlowsPullDeps = deps ?? {
    flowsVersion: cliPackageJson.dependencies["@qawolf/flows"],
    fs: ctx.fs,
  };
  const validation = validateEnvId(opts.env);
  if (validation !== "ok") {
    ctx.ui.error(validation.error);
    return { error: validation.error };
  }

  const destAbs = resolve(opts.out ?? join(".qawolf", opts.env));
  const assetsAbs = join(dirname(destAbs), "assets");
  // Shared assets sibling of the env directory. Created unconditionally so
  // TEAM_STORAGE_DIR resolves to a real path even before any asset is dropped
  // in. Idempotent across re-pulls.
  await resolvedDeps.fs.mkdir(assetsAbs, { recursive: true });
  const yes = opts.yes ?? false;
  let archive: string | undefined;

  try {
    const fetched = await fetchBundleAndEnvVars(ctx, opts.env);
    archive = fetched.tmpArchive;

    const safety = await checkSafety({
      envDir: destAbs,
      yes,
      interactive: ctx.isInteractive,
      log: (m) => ctx.ui.warn(m),
      confirm: async (m) => {
        const r = await ctx.ui.confirm(m, { destructive: true });
        return r.ok && r.value;
      },
    });
    if (safety === "needs-yes") {
      ctx.ui.error(flowsMessages.pull.needsYesError);
      return { error: "local modifications require --yes" };
    }
    if (safety === "abort") {
      ctx.ui.info(flowsMessages.pull.aborted);
      return;
    }

    const [result, assetResult] = await ctx.ui.withProgress(
      [
        {
          message: flowsMessages.pull.extractingBundle,
          task: () =>
            stageBundle(
              {
                tmpArchive: fetched.tmpArchive,
                destAbs,
                assetsAbs,
                envId: opts.env,
                envSlug: opts.envSlug,
                envName: opts.envName,
                cliFlowsVersion: resolvedDeps.flowsVersion,
                now: fetched.bundleFetchedAt,
                envVars: fetched.envVars,
                envVarsFetchedAt: fetched.envVarsFetchedAt,
                tags: fetched.tags,
              },
              resolvedDeps.fs,
            ),
        },
        {
          message: flowsMessages.pull.downloadingTeamStorageAssets,
          task: async (update) => {
            const result = await ctx.platformClient.syncTeamStorageAssets(
              assetsAbs,
              {
                onProgress: ({ current, total }) =>
                  update(
                    flowsMessages.pull.downloadingTeamStorageAssetsProgress(
                      current,
                      total,
                    ),
                  ),
              },
            );
            if (!result.ok) throw new Error(result.error);
            return result.value;
          },
        },
      ],
      (results) =>
        flowsMessages.pull.summary(
          {
            ...results[0],
            assetDownloadedCount: results[1].downloadedCount,
            assetReusedCount: results[1].reusedCount,
            assetSkippedCount: results[1].skippedCount,
          },
          assetsAbs,
        ),
    );

    reportPullResult(ctx.ui, {
      env: opts.env,
      assetsAbs,
      fetchedAt: fetched.bundleFetchedAt,
      stage: result,
      assets: assetResult,
    });
  } finally {
    if (archive !== undefined)
      await resolvedDeps.fs.unlink(archive).catch(() => {});
  }
}
