import { pluralize } from "~/core/pluralize.js";

type PullSummaryResult = {
  envDir: string;
  flowCount: number;
  envVarCount: number;
  flowsWithTeamStorageRefs: string[];
  assetDownloadedCount: number;
  assetSkippedCount: number;
};

export function formatPullSummary(
  result: PullSummaryResult,
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
    summary += `\nTeam-storage assets referenced by ${refs}:`;
    for (const path of result.flowsWithTeamStorageRefs) {
      summary += `\n  - ${path}`;
    }
  }
  summary += `\nDownloaded ${pluralize(
    result.assetDownloadedCount,
    "team-storage asset",
  )} into ${assetsAbs}`;
  if (result.assetSkippedCount > 0) {
    summary += ` (${pluralize(
      result.assetSkippedCount,
      "unsafe or unsupported asset",
    )} skipped)`;
  }
  return summary;
}
