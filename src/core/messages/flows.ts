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

export const flowsMessages = {
  title: "Flows",
  remoteTitle: "Remote Flows",
  flowCount: (count: number) => pluralize(count, "flow"),
  list: {
    remoteRequiresEnv:
      "--remote requires an environment. Pass --env <env> or set QAWOLF_ENVIRONMENT.",
    flagsRequireRemote: "--env and --include-drafts require --remote",
  },
  selectors: {
    tagsNotCached:
      "No cached tags found. Run 'qawolf flows pull --env <env>' to cache them, or pass --remote to read tags from the platform.",
    tagsUnavailable: (env: string) =>
      `Could not reach the platform and no tags are cached for environment '${env}'. Run 'qawolf flows pull --env ${env}' while online.`,
    usingCachedTags: (fetchedAt: string) =>
      `Could not reach the platform. Using tags cached at ${fetchedAt}; tag names were not validated.`,
    unknownTag: (name: string, suggestion: string | undefined) =>
      suggestion === undefined
        ? `No tag named '${name}' on this team. Run 'qawolf tag list' to see available tags.`
        : `No tag named '${name}' on this team. Did you mean '${suggestion}'?`,
    noFlowsSelected: (selectors: {
      readonly tags: readonly string[];
    }): string => `No flows matched tags ${selectors.tags.join(", ")}.`,
  },
  run: {
    requiresEnv:
      "An environment is required. Pass --env <env> or set QAWOLF_ENVIRONMENT.",
  },
  pull: {
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
    teamStorageRequiresTeamKey:
      "Team storage requires a team API key; organization keys are not supported here.",
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
    localModsWouldOverwrite: (
      count: number,
      envDir: string,
      fileList: string,
    ) =>
      `${count} locally-modified file(s) under ${envDir} would be overwritten:\n${fileList}`,
  },
  ensureDeps: {
    multiPackagePattern: (count: number, listed: string) =>
      `Pattern matches flows from ${count} packages — narrow it to a single package:\n${listed}\n\nHint: pass a pattern scoped to one package, e.g \`qawolf flows run '.qawolf/<env>/**'\`.`,
  },
  dotenv: {
    unparseableLine: (line: string) =>
      `Cannot parse .env line: ${JSON.stringify(line)}`,
  },
} as const;
