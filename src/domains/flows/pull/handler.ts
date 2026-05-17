import { unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

import cliPackageJson from "../../../../package.json" with { type: "json" };

import { resolveApiKey } from "~/domains/auth/index.js";
import {
  type CommandContext,
  type CommandResult,
} from "~/shell/commandContext.js";
import { pluralize } from "~/core/pluralize.js";
import { fetchBundleAndEnvVars } from "./fetchPhase.js";
import { manifestFilename } from "./manifest.js";
import { checkSafety, validateEnvId } from "./pull.js";
import { stageBundle } from "./stage.js";

export type FlowsPullOptions = {
  readonly env: string;
  readonly out?: string;
  readonly yes?: boolean;
};

function formatPullSummary(result: {
  envDir: string;
  flowCount: number;
  envVarCount: number;
  bundleFlowsVersion: string | undefined;
}): string {
  const flows = pluralize(result.flowCount, "flow");
  const envVars =
    result.envVarCount === 0
      ? ""
      : ` and ${pluralize(result.envVarCount, "environment variable")}`;
  const base = `Pulled ${flows}${envVars} into ${result.envDir}`;
  if (!result.bundleFlowsVersion) return base;
  return `${base} (@qawolf/flows@${result.bundleFlowsVersion})`;
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

  const resolved = await resolveApiKey(ctx.configDir);
  if (!resolved) {
    ctx.ui.error(
      "Not authenticated",
      "Run `qawolf auth login` or set QAWOLF_API_KEY.",
    );
    return { error: "not authenticated" };
  }

  const destAbs = resolve(opts.out ?? join(".qawolf", opts.env));
  const yes = opts.yes ?? false;
  const fetch = globalThis.fetch;
  let archive: string | undefined;

  try {
    const fetched = await fetchBundleAndEnvVars(
      ctx,
      opts.env,
      resolved.key,
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
              envId: opts.env,
              cliFlowsVersion: deps.flowsVersion,
              now: fetched.bundleFetchedAt,
              envVars: fetched.envVars,
              envVarsFetchedAt: fetched.envVarsFetchedAt,
            }),
        },
      ],
      (results) => formatPullSummary(results[0]),
    );

    if (ctx.ui.mode === "json") {
      ctx.ui.output(
        {
          env: opts.env,
          envDir: result.envDir,
          fetchedAt: fetched.bundleFetchedAt.toISOString(),
          flowCount: result.flowCount,
          envVarCount: result.envVarCount,
          manifestPath: join(result.envDir, manifestFilename),
        },
        "",
      );
    }
  } finally {
    if (archive !== undefined) await unlink(archive).catch(() => {});
  }
}
