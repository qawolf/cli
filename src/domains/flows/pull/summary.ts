import { pluralize } from "~/core/pluralize.js";

type PullSummaryResult = {
  envDir: string;
  flowCount: number;
  envVarCount: number;
  flowsWithTeamStorageRefs: string[];
  assetDownloadedCount: number;
  assetReusedCount: number;
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
  const lines = [`Pulled ${flows}${envVars} into ${result.envDir}`];
  if (result.flowsWithTeamStorageRefs.length > 0) {
    const refs = pluralize(result.flowsWithTeamStorageRefs.length, "flow");
    lines.push(`Team-storage assets referenced by ${refs}:`);
    for (const path of result.flowsWithTeamStorageRefs) {
      lines.push(`  - ${path}`);
    }
  }
  if (
    result.assetDownloadedCount > 0 ||
    result.assetReusedCount > 0 ||
    result.assetSkippedCount > 0
  ) {
    const assetParts: string[] = [];
    if (result.assetDownloadedCount > 0) {
      assetParts.push(
        `Downloaded ${pluralize(
          result.assetDownloadedCount,
          "team-storage asset",
        )}`,
      );
    }
    if (result.assetReusedCount > 0) {
      assetParts.push(
        `reused ${pluralize(result.assetReusedCount, "team-storage asset")}`,
      );
    }
    let assetSummary =
      assetParts.length > 0
        ? `${assetParts.join(" and ")} into ${assetsAbs}`
        : `Skipped ${pluralize(
            result.assetSkippedCount,
            "unsafe or unsupported asset",
          )}`;
    if (assetParts.length > 0 && result.assetSkippedCount > 0) {
      assetSummary += ` (${pluralize(
        result.assetSkippedCount,
        "unsafe or unsupported asset",
      )} skipped)`;
    }
    lines.push(assetSummary);
  }
  return lines.join("\n");
}
