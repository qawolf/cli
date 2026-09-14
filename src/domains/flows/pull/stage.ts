import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import { writeManifest } from "~/shell/manifest/io.js";
import {
  buildManifest,
  flattenSingleWrapper,
  sampleQawolfCommittedAt,
  type FetchedTags,
} from "./bundle.js";
import {
  findMissingEnvVars,
  type MissingEnvVar,
} from "~/core/envVarAnalysis/missing.js";
import { applyTeamStorageRewrite } from "./applyTeamStorageRewrite.js";
import { carriedFromPreviousPull } from "./previousPull.js";
import { collectFlowEnvVars } from "./collectFlowEnvVars.js";
import { writeEnvFile } from "./envVars.js";
import { extractTarGz } from "./extract.js";
import {
  createTempPathRegistry,
  mintTempPath,
  removeTempDir,
} from "./safeRemove.js";

type StageBundleArgs = {
  tmpArchive: string;
  destAbs: string;
  assetsAbs: string;
  envId: string;
  envSlug: string | undefined;
  envName: string | undefined;
  cliFlowsVersion: string;
  now: Date;
  envVars: Record<string, string>;
  envVarsFetchedAt: Date;
  tags: FetchedTags | undefined;
};

type StageBundleResult = {
  envDir: string;
  flowCount: number;
  envVarCount: number;
  flowsWithTeamStorageRefs: string[];
  // Variables the flows read that this environment does not define, most-read
  // first. Aggregated by name rather than by flow: one missing variable in a
  // shared helper reaches nearly every flow, so a per-flow list is unreadable.
  missingEnvVars: MissingEnvVar[];
  incompleteFlowCount: number;
};

export async function stageBundle(
  args: StageBundleArgs,
  fs: Fs = makeDefaultFs(),
): Promise<StageBundleResult> {
  const registry = createTempPathRegistry();
  const tmpDir = mintTempPath(args.destAbs, "pull", registry);

  try {
    await extractTarGz(args.tmpArchive, tmpDir, {}, fs);
    const wrapperName = await flattenSingleWrapper(tmpDir, fs);
    // Sample mtime before any local rewrite so qawolfCommittedAt reflects
    // the upstream commit time, not our write time.
    const qawolfCommittedAt = await sampleQawolfCommittedAt(tmpDir, fs);
    // Rewrite literal /home/wolf/team-storage/ references in source files to
    // ${process.env.TEAM_STORAGE_DIR}/. Must run before buildManifest so the
    // content hashes match what's actually on disk.
    const { flowsWithTeamStorageRefs } = await applyTeamStorageRewrite(
      tmpDir,
      fs,
    );
    // TEAM_STORAGE_DIR is overridden locally: the API ships the runner mount
    // path (/home/wolf/team-storage) which doesn't exist on this machine. The
    // rewriter has already normalized literal mount-path references to use
    // this env var, so all team-storage lookups resolve to the local assets/
    // directory.
    const effectiveEnvVars = {
      ...args.envVars,
      TEAM_STORAGE_DIR: args.assetsAbs,
    };
    await writeEnvFile(tmpDir, effectiveEnvVars, fs);
    const { byFlow } = await collectFlowEnvVars(tmpDir);
    const missingEnvVars = findMissingEnvVars({
      byFlow,
      definedNames: new Set(Object.keys(effectiveEnvVars)),
    });
    // A failed tag fetch must not erase cached tags.
    const carried =
      args.tags === undefined
        ? await carriedFromPreviousPull(args.destAbs, fs)
        : undefined;
    const manifest = await buildManifest(
      {
        envId: args.envId,
        tags: args.tags ?? carried?.tags,
        envSlug: args.envSlug,
        envName: args.envName,
        bundleDir: tmpDir,
        cliFlowsVersion: args.cliFlowsVersion,
        now: args.now,
        envVarsFetchedAt: args.envVarsFetchedAt,
        wrapperName,
        qawolfCommittedAt,
        envVarsByFlow: byFlow,
      },
      fs,
    );
    await writeManifest(tmpDir, manifest, fs);

    let oldDir: string | undefined;
    try {
      if (await fs.pathExists(args.destAbs)) {
        oldDir = mintTempPath(args.destAbs, "old", registry);
        await fs.rename(args.destAbs, oldDir);
      }
      await fs.rename(tmpDir, args.destAbs);
    } catch (err) {
      if (oldDir) await fs.rename(oldDir, args.destAbs).catch(() => {});
      throw err;
    }

    if (oldDir) await removeTempDir(oldDir, registry, fs).catch(() => {});

    return {
      envDir: args.destAbs,
      flowCount: manifest.flows.length,
      envVarCount: Object.keys(effectiveEnvVars).length,
      flowsWithTeamStorageRefs,
      missingEnvVars,
      incompleteFlowCount: [...byFlow.values()].filter(
        (entry) => entry.mayBeIncomplete,
      ).length,
    };
  } catch (err) {
    await removeTempDir(tmpDir, registry, fs).catch(() => {});
    throw err;
  }
}
