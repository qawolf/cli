import { unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

import { resolveApiKey } from "~/lib/auth/index.js";
import { type CommandContext, type CommandResult } from "~/lib/context.js";
import cliPackageJson from "../../../../package.json" with { type: "json" };
import {
  checkSafety,
  downloadBundle,
  requestBundle,
  validateEnvId,
} from "./pull.js";
import { stageBundle } from "./stage.js";

const flowsVersionFromCli = cliPackageJson.dependencies["@qawolf/flows"];

export type FlowsPullOptions = {
  readonly env: string;
  readonly out?: string;
  readonly yes?: boolean;
};

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
    let signedUrl: string | undefined;
    await ctx.ui.withProgress(
      [
        {
          message: "Resolving signed URL",
          task: async () => {
            signedUrl = (
              await requestBundle(
                { apiKey: resolved.key, baseUrl: ctx.apiBaseUrl, fetch },
                opts.env,
              )
            ).signedUrl;
          },
        },
        {
          message: "Downloading bundle",
          task: async () => {
            if (signedUrl === undefined) {
              throw new Error("internal: signedUrl not set");
            }
            archive = (await downloadBundle({ fetch }, signedUrl)).tmpArchive;
          },
        },
      ],
      "Downloaded",
    );

    if (archive === undefined) {
      throw new Error("internal: archive not set");
    }
    const archivePath = archive;

    const safety = await checkSafety({
      envDir: destAbs,
      yes,
      log: (m) => ctx.ui.warn(m),
      confirm: async (m) => {
        const r = await ctx.ui.confirm(m, { destructive: true });
        return r.ok && r.value;
      },
    });
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
              tmpArchive: archivePath,
              destAbs,
              envId: opts.env,
              cliFlowsVersion: flowsVersionFromCli,
              now: new Date(),
            }),
        },
      ],
      (r) => {
        const count = r[0].flowCount;
        const word = count === 1 ? "flow" : "flows";
        const base = `Pulled ${String(count)} ${word} into ${r[0].envDir}`;
        return r[0].bundleFlowsVersion
          ? `${base} (@qawolf/flows@${r[0].bundleFlowsVersion})`
          : base;
      },
    );

    // json consumers want the structured result alongside the success line.
    if (ctx.ui.mode === "json") {
      ctx.ui.output(
        {
          envDir: result.envDir,
          flowCount: result.flowCount,
          bundleFlowsVersion: result.bundleFlowsVersion,
        },
        "",
      );
    }
  } finally {
    if (archive !== undefined) await unlink(archive).catch(() => {});
  }
}
