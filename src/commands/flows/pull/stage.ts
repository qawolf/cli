import { rename } from "node:fs/promises";

import { pathExists } from "~/lib/fs.js";
import { buildManifest, flattenSingleWrapper } from "./bundle.js";
import { extractTarGz } from "./extract.js";
import { writeManifest } from "./manifest.js";
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
};

type StageBundleResult = {
  envDir: string;
  flowCount: number;
  bundleFlowsVersion: string | undefined;
};

export async function stageBundle(
  args: StageBundleArgs,
): Promise<StageBundleResult> {
  const registry = createTempPathRegistry();
  const tmpDir = mintTempPath(args.destAbs, "pull", registry);

  try {
    await extractTarGz(args.tmpArchive, tmpDir);
    await flattenSingleWrapper(tmpDir);
    const manifest = await buildManifest({
      envId: args.envId,
      bundleDir: tmpDir,
      cliFlowsVersion: args.cliFlowsVersion,
      now: args.now,
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
      flowCount: manifest.files.length,
      bundleFlowsVersion: manifest.bundleFlowsVersion,
    };
  } catch (err) {
    await removeTempDir(tmpDir, registry).catch(() => {});
    throw err;
  }
}
