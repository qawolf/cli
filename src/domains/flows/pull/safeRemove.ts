import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import { isAbsolute } from "node:path";

type TempPathKind = "pull" | "old";

type TempPathRegistry = {
  readonly minted: Set<string>;
};

export function createTempPathRegistry(): TempPathRegistry {
  return { minted: new Set<string>() };
}

const sentinelPattern = /\.(pull|old)-[a-f0-9]{16}$/;

export function mintTempPath(
  destAbs: string,
  kind: TempPathKind,
  registry: TempPathRegistry,
): string {
  if (!isAbsolute(destAbs)) {
    throw new Error(`mintTempPath: destAbs is not absolute (${destAbs})`);
  }
  const suffix = randomBytes(8).toString("hex");
  const path = `${destAbs}.${kind}-${suffix}`;
  registry.minted.add(path);
  return path;
}

export async function removeTempDir(
  absPath: string,
  registry: TempPathRegistry,
): Promise<void> {
  if (!absPath || !isAbsolute(absPath)) {
    throw new Error(`removeTempDir refused: not an absolute path (${absPath})`);
  }
  if (!sentinelPattern.test(absPath)) {
    throw new Error(`removeTempDir refused: missing sentinel (${absPath})`);
  }
  if (!registry.minted.has(absPath)) {
    throw new Error(`removeTempDir refused: not minted in this registry`);
  }
  await rm(absPath, { recursive: true, force: true });
  registry.minted.delete(absPath);
}
