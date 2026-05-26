import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import { dirname, join, resolve } from "node:path";

import cliPackageJson from "../../../../package.json" with { type: "json" };

import {
  type AuthCommandContext,
  type CommandResult,
} from "~/shell/commandContext.js";
import { manifestFilename } from "~/shell/manifest/io.js";
import { flowsMessages } from "~/core/messages/index.js";
import { fetchBundleAndEnvVars } from "./fetchPhase.js";
import { checkSafety, validateEnvId } from "./pull.js";
import { stageBundle } from "./stage.js";

export type FlowsPullOptions = {
  readonly env: string;
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
  deps: HandleFlowsPullDeps = {
    flowsVersion: cliPackageJson.dependencies["@qawolf/flows"],
    fs: makeDefaultFs(),
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
  await deps.fs.mkdir(assetsAbs, { recursive: true });
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

    const [result] = await ctx.ui.withProgress(
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
                cliFlowsVersion: deps.flowsVersion,
                now: fetched.bundleFetchedAt,
                envVars: fetched.envVars,
                envVarsFetchedAt: fetched.envVarsFetchedAt,
              },
              deps.fs,
            ),
        },
      ],
      (results) => flowsMessages.pull.summary(results[0], assetsAbs),
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
    if (archive !== undefined) await deps.fs.unlink(archive).catch(() => {});
  }
}
