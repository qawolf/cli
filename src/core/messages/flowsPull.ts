import type { MissingEnvVar } from "~/core/envVarAnalysis/missing.js";
import { pluralize } from "~/core/pluralize.js";

type PullSummaryInput = {
  readonly envDir: string;
  readonly flowCount: number;
  readonly envVarCount: number;
  readonly flowsWithTeamStorageRefs: readonly string[];
  readonly incompleteFlowCount?: number | undefined;
  readonly assetDownloadedCount?: number | undefined;
  readonly assetReusedCount?: number | undefined;
  readonly assetSkippedCount?: number | undefined;
};

// Enough to act on without turning a spinner's stop message into a wall of
// text; the full set is always in the JSON output.
const maxListedNames = 5;

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
    // Shared dynamic helpers can affect every flow; report their impact once.
    const incomplete = result.incompleteFlowCount ?? 0;
    if (incomplete > 0) {
      lines.push(
        `${pluralize(incomplete, "flow")} may read more variables than listed; static analysis could not resolve every read.`,
      );
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
  missingEnvVars: (missing: readonly MissingEnvVar[]) => {
    // A read does not prove a variable is required by the flow.
    const lines = [
      `${pluralize(missing.length, "environment variable")} ${
        missing.length === 1 ? "is" : "are"
      } read by flows but not set in this environment (some reads may be optional):`,
    ];
    for (const { name, flowCount } of missing.slice(0, maxListedNames)) {
      lines.push(`  - ${name} (read by ${pluralize(flowCount, "flow")})`);
    }
    if (missing.length > maxListedNames) {
      lines.push(`  ... and ${String(missing.length - maxListedNames)} more`);
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
