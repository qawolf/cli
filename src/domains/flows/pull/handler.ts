import { mkdir, unlink } from "~/shell/fs.js";
import { dirname, join, resolve } from "node:path";

import cliPackageJson from "../../../../package.json" with { type: "json" };

import {
  type CommandContext,
  type CommandResult,
} from "~/shell/commandContext.js";
import { pluralize } from "~/core/pluralize.js";
import { manifestFilename } from "~/shell/manifest/io.js";
import { fetchBundleAndEnvVars } from "./fetchPhase.js";
import { checkSafety, validateEnvId } from "./pull.js";
import { stageBundle } from "./stage.js";

export type FlowsPullOptions = {
  readonly env: string;
  readonly out?: string;
  readonly yes?: boolean;
  /** Resolved API key — must be provided by the command layer. */
  readonly apiKey: string;
};

function formatPullSummary(
  result: {
    envDir: string;
    flowCount: number;
    envVarCount: number;
    flowsWithTeamStorageRefs: string[];
  },
  assetsAbs: string,
): string {
  const flows = pluralize(result.flowCount, "flow");
  const envVars =
    result.envVarCount === 0
      ? ""
      : ` and ${pluralize(result.envVarCount, "environment variable")}`;
  let summary = `Pulled ${flows}${envVars} into ${result.envDir}`;
  if (result.flowsWithTeamStorageRefs.length > 0) {
    const refs = pluralize(result.flowsWithTeamStorageRefs.length, "flow");
    summary += `\nTeam-storage assets required for ${refs} — populate ${assetsAbs} before running:`;
    for (const path of result.flowsWithTeamStorageRefs) {
      summary += `\n  - ${path}`;
    }
  }
  return summary;
}

type HandleFlowsPullDeps = {
  readonly flowsVersion: string;
};

export async function handleFlowsPull(
  ctx: CommandContext,
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
  const fetch = globalThis.fetch;
  let archive: string | undefined;

  try {
    const fetched = await fetchBundleAndEnvVars(
      ctx,
      opts.env,
      opts.apiKey,
      fetch,
    );
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

    const [result] = await ctx.ui.withProgress(
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
      ],
      (results) => formatPullSummary(results[0], assetsAbs),
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
          manifestPath: join(result.envDir, manifestFilename),
        },
        "",
      );
    }
  } finally {
    if (archive !== undefined) await unlink(archive).catch(() => {});
  }
}
