import { join } from "node:path";

import { manifestFilename } from "~/shell/manifest/io.js";
import type { UI } from "~/shell/ui/index.js";

type StageResult = {
  readonly envDir: string;
  readonly flowCount: number;
  readonly envVarCount: number;
  readonly flowsWithTeamStorageRefs: string[];
};

type AssetResult = {
  readonly downloadedCount: number;
  readonly reusedCount: number;
  readonly skippedCount: number;
};

/**
 * Emits the machine-readable pull result. Human and agent modes already got
 * the progress summary, so only JSON mode has anything left to say.
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
      assetDownloadedCount: args.assets.downloadedCount,
      assetReusedCount: args.assets.reusedCount,
      assetSkippedCount: args.assets.skippedCount,
      manifestPath: join(args.stage.envDir, manifestFilename),
    },
    "",
  );
}
