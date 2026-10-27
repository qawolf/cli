import { join } from "node:path";

import { flowsMessages } from "~/core/messages/index.js";

import type { MissingEnvVar } from "~/core/envVarAnalysis/missing.js";
import { manifestFilename } from "~/shell/manifest/io.js";
import type { UI } from "~/shell/ui/index.js";

type StageResult = {
  readonly envDir: string;
  readonly flowCount: number;
  readonly envVarCount: number;
  readonly flowsWithTeamStorageRefs: string[];
  readonly missingEnvVars: MissingEnvVar[];
  readonly incompleteFlowCount: number;
};

type AssetResult = {
  readonly downloadedCount: number;
  readonly reusedCount: number;
  readonly skippedCount: number;
};

/**
 * Reports what the pull found once the spinner has stopped: a warning, in every
 * mode, for variables the flows read that this environment does not set; then
 * the machine-readable result in JSON mode. Human and agent modes already got
 * the progress summary.
 */
export function reportPullResult(
  ui: UI,
  args: {
    readonly env: string;
    readonly assetsAbs: string;
    readonly fetchedAt: Date;
    readonly stage: StageResult;
    readonly assets: AssetResult;
  },
): void {
  // Here rather than in the progress steps, so the spinner cannot overwrite it.
  if (args.stage.missingEnvVars.length > 0) {
    ui.warn(flowsMessages.pull.missingEnvVars(args.stage.missingEnvVars));
  }
  if (ui.mode !== "json") return;
  ui.output(
    {
      env: args.env,
      envDir: args.stage.envDir,
      assetsDir: args.assetsAbs,
      fetchedAt: args.fetchedAt.toISOString(),
      flowCount: args.stage.flowCount,
      envVarCount: args.stage.envVarCount,
      flowsWithTeamStorageRefs: args.stage.flowsWithTeamStorageRefs,
      missingEnvVars: args.stage.missingEnvVars,
      incompleteFlowCount: args.stage.incompleteFlowCount,
      assetDownloadedCount: args.assets.downloadedCount,
      assetReusedCount: args.assets.reusedCount,
      assetSkippedCount: args.assets.skippedCount,
      manifestPath: join(args.stage.envDir, manifestFilename),
    },
    "",
  );
}
