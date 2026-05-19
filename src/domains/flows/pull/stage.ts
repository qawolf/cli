import { pathExists, rename } from "~/shell/fs.js";
import { writeManifest } from "~/shell/manifest/io.js";
import {
  buildManifest,
  flattenSingleWrapper,
  sampleQawolfCommittedAt,
} from "./bundle.js";
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
  envId: string;
  cliFlowsVersion: string;
  now: Date;
  envVars: Record<string, string>;
  envVarsFetchedAt: Date;
};

type StageBundleResult = {
  envDir: string;
  flowCount: number;
  envVarCount: number;
};

export async function stageBundle(
  args: StageBundleArgs,
): Promise<StageBundleResult> {
  const registry = createTempPathRegistry();
  const tmpDir = mintTempPath(args.destAbs, "pull", registry);

  try {
    await extractTarGz(args.tmpArchive, tmpDir);
    const wrapperName = await flattenSingleWrapper(tmpDir);
    // Sample mtime before any local rewrite so qawolfCommittedAt reflects
    // the upstream commit time, not our write time.
    const qawolfCommittedAt = await sampleQawolfCommittedAt(tmpDir);
    // Overwrites any .env that came in the flows bundle — API is authoritative.
    await writeEnvFile(tmpDir, args.envVars);
    const manifest = await buildManifest({
      envId: args.envId,
      bundleDir: tmpDir,
      cliFlowsVersion: args.cliFlowsVersion,
      now: args.now,
      envVarsFetchedAt: args.envVarsFetchedAt,
      wrapperName,
      qawolfCommittedAt,
    });
    await writeManifest(tmpDir, manifest);

    let oldDir: string | undefined;
    try {
      if (await pathExists(args.destAbs)) {
        oldDir = mintTempPath(args.destAbs, "old", registry);
        await rename(args.destAbs, oldDir);
      }
      await rename(tmpDir, args.destAbs);
    } catch (err) {
      if (oldDir) await rename(oldDir, args.destAbs).catch(() => {});
      throw err;
    }

    if (oldDir) await removeTempDir(oldDir, registry).catch(() => {});

    return {
      envDir: args.destAbs,
      flowCount: manifest.flows.length,
      envVarCount: Object.keys(args.envVars).length,
    };
  } catch (err) {
    await removeTempDir(tmpDir, registry).catch(() => {});
    throw err;
  }
}
