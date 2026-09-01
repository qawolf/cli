import { toPosix } from "~/core/repoRelativePath.js";
import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import { readManifest, writeManifest } from "~/shell/manifest/io.js";
import {
  buildManifest,
  flattenSingleWrapper,
  sampleQawolfCommittedAt,
  type FetchedTags,
} from "./bundle.js";
import { applyTeamStorageRewrite } from "./applyTeamStorageRewrite.js";
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
    const manifest = await buildManifest(
      {
        envId: args.envId,
        tags: args.tags ?? (await carriedTags(args.destAbs, fs)),
        envSlug: args.envSlug,
        envName: args.envName,
        bundleDir: tmpDir,
        cliFlowsVersion: args.cliFlowsVersion,
        now: args.now,
        envVarsFetchedAt: args.envVarsFetchedAt,
        wrapperName,
        qawolfCommittedAt,
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
    };
  } catch (err) {
    await removeTempDir(tmpDir, registry, fs).catch(() => {});
    throw err;
  }
}

/**
 * Tags kept from the previous pull of this environment.
 *
 * A pull rebuilds the manifest from the bundle, so a failed tag fetch would
 * otherwise erase tags that were cached successfully earlier. Stale tags are
 * reported as stale; losing them silently would break every offline query.
 */
async function carriedTags(
  envDir: string,
  fs: Fs,
): Promise<FetchedTags | undefined> {
  const previous = await readManifest(envDir, fs);
  if (typeof previous === "string") return undefined;
  if (previous.tagsFetchedAt === undefined) return undefined;

  const byPath = new Map<string, string[]>();
  for (const flow of previous.flows) {
    // A manifest written by an older CLI on win32 may hold `\` paths; the new
    // manifest looks entries up by posix path, so normalize or the carried
    // tags never match and vanish silently.
    if (flow.tags !== undefined) byPath.set(toPosix(flow.path), [...flow.tags]);
  }
  return { fetchedAt: new Date(previous.tagsFetchedAt), byPath };
}
