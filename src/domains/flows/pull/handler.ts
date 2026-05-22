import { mkdir, unlink } from "~/shell/fs.js";
import { dirname, join, resolve } from "node:path";

import cliPackageJson from "../../../../package.json" with { type: "json" };

import {
  type AuthCommandContext,
  type CommandResult,
} from "~/shell/commandContext.js";
import { manifestFilename } from "~/shell/manifest/io.js";
import { fetchBundleAndEnvVars } from "./fetchPhase.js";
import { checkSafety, validateEnvId } from "./pull.js";
import { stageBundle } from "./stage.js";
import { formatPullSummary } from "./summary.js";

export type FlowsPullOptions = {
  readonly env: string;
  readonly out?: string;
  readonly yes?: boolean;
};

type HandleFlowsPullDeps = {
  readonly flowsVersion: string;
};

export async function handleFlowsPull(
  ctx: AuthCommandContext,
  opts: FlowsPullOptions,
  deps: HandleFlowsPullDeps = {
    flowsVersion: cliPackageJson.dependencies["@qawolf/flows"],
  },
): Promise<CommandResult> {
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
  await mkdir(assetsAbs, { recursive: true });
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
      ctx.ui.error("Re-run with --yes to overwrite locally-modified files");
      return { error: "local modifications require --yes" };
    }
    if (safety === "abort") {
      ctx.ui.info("Aborted; no changes.");
      return;
    }

    const [result, assetResult] = await ctx.ui.withProgress(
      [
        {
          message: "Extracting bundle",
          task: () =>
            stageBundle({
              tmpArchive: fetched.tmpArchive,
              destAbs,
              assetsAbs,
              envId: opts.env,
              cliFlowsVersion: deps.flowsVersion,
              now: fetched.bundleFetchedAt,
              envVars: fetched.envVars,
              envVarsFetchedAt: fetched.envVarsFetchedAt,
            }),
        },
        {
          message: "Downloading team-storage assets",
          task: async () => {
            const result = await ctx.platform.syncTeamStorageAssets(assetsAbs);
            if (!result.ok) throw new Error(result.error);
            return result.value;
          },
        },
      ],
      (results) =>
        formatPullSummary(
          {
            ...results[0],
            assetDownloadedCount: results[1].downloadedCount,
            assetSkippedCount: results[1].skippedCount,
          },
          assetsAbs,
        ),
    );

    if (ctx.ui.mode === "json") {
      ctx.ui.output(
        {
          env: opts.env,
          envDir: result.envDir,
          assetsDir: assetsAbs,
          fetchedAt: fetched.bundleFetchedAt.toISOString(),
          flowCount: result.flowCount,
          envVarCount: result.envVarCount,
          flowsWithTeamStorageRefs: result.flowsWithTeamStorageRefs,
          assetDownloadedCount: assetResult.downloadedCount,
          assetSkippedCount: assetResult.skippedCount,
          manifestPath: join(result.envDir, manifestFilename),
        },
        "",
      );
    }
  } finally {
    if (archive !== undefined) await unlink(archive).catch(() => {});
  }
}
