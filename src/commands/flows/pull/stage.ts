import { rename, stat } from "node:fs/promises";
import { resolve } from "node:path";

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
  const destAbs = resolve(args.destAbs);
  const registry = createTempPathRegistry();
  const tmpDir = mintTempPath(destAbs, "pull", registry);

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
      if (await dirExists(destAbs)) {
        oldDir = mintTempPath(destAbs, "old", registry);
        await rename(destAbs, oldDir);
      }
      await rename(tmpDir, destAbs);
    } catch (err: unknown) {
      if (oldDir) await rename(oldDir, destAbs).catch(() => {});
      throw err;
    }

    if (oldDir) await removeTempDir(oldDir, registry).catch(() => {});

    return {
      envDir: destAbs,
      flowCount: manifest.files.length,
      bundleFlowsVersion: manifest.bundleFlowsVersion,
    };
  } catch (err: unknown) {
    await removeTempDir(tmpDir, registry).catch(() => {});
    throw err;
  }
}

async function dirExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
