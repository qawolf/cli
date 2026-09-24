import { pluralize } from "~/core/pluralize.js";

type PullSummaryInput = {
  readonly envDir: string;
  readonly flowCount: number;
  readonly envVarCount: number;
  readonly flowsWithTeamStorageRefs: readonly string[];
  readonly assetDownloadedCount?: number | undefined;
  readonly assetReusedCount?: number | undefined;
  readonly assetSkippedCount?: number | undefined;
};

export const flowsPullMessages = {
  requiresEnv:
    "An environment is required. Pass --env <env> or set QAWOLF_ENVIRONMENT.",
  downloadingBundle: "Downloading flows bundle",
  fetchingEnvVars: "Fetching environment variables",
  fetchingTags: "Fetching flow tags",
  downloadComplete: "Downloaded flows bundle and environment variables",
  needsYesError: "Re-run with --yes to overwrite locally-modified files",
  aborted: "Aborted; no changes.",
  extractingBundle: "Extracting bundle",
  downloadingTeamStorageAssets: "Downloading team-storage assets",
  downloadingTeamStorageAssetsProgress: (current: number, total: number) =>
    `Downloading team-storage assets (${String(current)}/${String(total)})`,
  teamStorageRequiresTeam:
    "Team storage needs a team. Pull an environment to name its team, choose a workspace with 'qawolf auth switch', or use a team API key.",
  summary: (result: PullSummaryInput, assetsAbs: string) => {
    const flows = pluralize(result.flowCount, "flow");
    const envVars =
      result.envVarCount === 0
        ? ""
        : ` and ${pluralize(result.envVarCount, "environment variable")}`;
    const lines = [`Pulled ${flows}${envVars} into ${result.envDir}`];
    if (result.flowsWithTeamStorageRefs.length > 0) {
      const refs = pluralize(result.flowsWithTeamStorageRefs.length, "flow");
      lines.push(`Team-storage assets referenced by ${refs}:`);
      for (const path of result.flowsWithTeamStorageRefs) {
        lines.push(`  - ${path}`);
      }
    }
    const downloaded = result.assetDownloadedCount ?? 0;
    const reused = result.assetReusedCount ?? 0;
    const skipped = result.assetSkippedCount ?? 0;
    if (downloaded > 0 || reused > 0 || skipped > 0) {
      let assetSummary = `Downloaded ${pluralize(
        downloaded,
        "team-storage asset",
      )}`;
      if (reused > 0) {
        assetSummary += ` and reused ${pluralize(
          reused,
          "team-storage asset",
        )}`;
      }
      assetSummary += ` into ${assetsAbs}`;
      if (skipped > 0) {
        assetSummary += ` (${pluralize(
          skipped,
          "unsafe or unsupported asset",
        )} skipped)`;
      }
      lines.push(assetSummary);
    }
    return lines.join("\n");
  },
  symlinkRejected: (path: string) => `symlink entry rejected: ${path}`,
  unknownEntrySize: (path: string) =>
    `entry with unknown size rejected: ${path}`,
  entryTooLarge: (path: string, size: number, maxBytes: number) =>
    `entry exceeds max size (${path}): ${String(size)} > ${String(maxBytes)}`,
  localModsWouldOverwrite: (count: number, envDir: string, fileList: string) =>
    `${count} locally-modified file(s) under ${envDir} would be overwritten:\n${fileList}`,
} as const;
