import { unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

import { resolveApiKey } from "~/lib/auth/index.js";
import { flowsVersionFromCli } from "~/lib/config.js";
import { type CommandContext, type CommandResult } from "~/lib/context.js";
import { pluralize } from "~/lib/pluralize.js";
import { fetchBundleAndEnvVars } from "./fetchPhase.js";
import { checkSafety, validateEnvId } from "./pull.js";
import { stageBundle } from "./stage.js";

export type FlowsPullOptions = {
  readonly env: string;
  readonly out?: string;
  readonly yes?: boolean;
};

function formatPullSummary(r: {
  envDir: string;
  flowCount: number;
  envVarCount: number;
  bundleFlowsVersion: string | undefined;
}): string {
  const flows = pluralize(r.flowCount, "flow");
  const envVars = pluralize(r.envVarCount, "environment variable");
  const base = `Pulled ${flows} and ${envVars} into ${r.envDir}`;
  return r.bundleFlowsVersion
    ? `${base} (@qawolf/flows@${r.bundleFlowsVersion})`
    : base;
}

export async function handleFlowsPull(
  ctx: CommandContext,
  opts: FlowsPullOptions,
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
              cliFlowsVersion: flowsVersionFromCli,
              now: new Date(),
              envVars: fetched.envVars,
              envVarsFetchedAt: fetched.envVarsFetchedAt,
            }),
        },
      ],
      (r) => formatPullSummary(r[0]),
    );

    if (ctx.ui.mode === "json") {
      ctx.ui.output(
        {
          envDir: result.envDir,
          flowCount: result.flowCount,
          envVarCount: result.envVarCount,
          bundleFlowsVersion: result.bundleFlowsVersion,
        },
        "",
      );
    }
  } finally {
    if (archive !== undefined) await unlink(archive).catch(() => {});
  }
}
