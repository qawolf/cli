import { pluralize } from "~/core/pluralize.js";

type PullSummaryInput = {
  readonly envDir: string;
  readonly flowCount: number;
  readonly envVarCount: number;
  readonly flowsWithTeamStorageRefs: readonly string[];
};

export const flowsMessages = {
  title: "Flows",
  flowCount: (count: number) => pluralize(count, "flow"),
  pull: {
    downloadingBundle: "Downloading flows bundle",
    fetchingEnvVars: "Fetching environment variables",
    downloadComplete: "Downloaded flows bundle and environment variables",
    needsYesError: "Re-run with --yes to overwrite locally-modified files",
    aborted: "Aborted; no changes.",
    extractingBundle: "Extracting bundle",
    summary: (result: PullSummaryInput, assetsAbs: string) => {
      const flows = pluralize(result.flowCount, "flow");
      const envVars =
        result.envVarCount === 0
          ? ""
          : ` and ${pluralize(result.envVarCount, "environment variable")}`;
      let summary = `Pulled ${flows}${envVars} into ${result.envDir}`;
      if (result.flowsWithTeamStorageRefs.length > 0) {
        const refs = pluralize(result.flowsWithTeamStorageRefs.length, "flow");
        summary += `\nTeam-storage assets required for ${refs} — populate ${assetsAbs} before running:`;
        for (const path of result.flowsWithTeamStorageRefs) {
          summary += `\n  - ${path}`;
        }
      }
      return summary;
    },
    symlinkRejected: (path: string) => `symlink entry rejected: ${path}`,
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
    installFailed: (pm: string, envDir: string, stderr: string) =>
      `${pm} install failed in ${envDir}:\n${stderr}`,
  },
  dotenv: {
    invalidKey: (key: string) =>
      `Cannot serialize env var with invalid key: ${JSON.stringify(key)}`,
    unparseableLine: (line: string) =>
      `Cannot parse .env line: ${JSON.stringify(line)}`,
  },
} as const;
