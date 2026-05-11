import { stat } from "node:fs/promises";
import { join } from "node:path";

import { type Manifest, hashFile } from "./manifest.js";

type LocalMod = {
  path: string;
  reason: "modified" | "missing-from-disk";
};

export async function detectLocalModifications(
  envDir: string,
  manifest: Manifest,
): Promise<LocalMod[]> {
  const mods: LocalMod[] = [];
  for (const entry of manifest.files) {
    const abs = join(envDir, entry.path);
    if (!(await fileExists(abs))) {
      mods.push({ path: entry.path, reason: "missing-from-disk" });
      continue;
    }
    const actual = await hashFile(abs);
    if (actual !== entry.sha256) {
      mods.push({ path: entry.path, reason: "modified" });
    }
  }
  return mods;
}

type PromptArgs = {
  envDir: string;
  manifest: Manifest;
  yes: boolean;
  log: (message: string) => void;
  confirm: (message: string, opts: { yes: boolean }) => Promise<boolean>;
};

export async function promptOverwriteIfModified(
  args: PromptArgs,
): Promise<"proceed" | "abort"> {
  const mods = await detectLocalModifications(args.envDir, args.manifest);
  const modified = mods.filter((m) => m.reason === "modified");
  if (modified.length === 0) return "proceed";

  const list = modified.map((m) => `  - ${m.path}`).join("\n");
  const summary = `${String(modified.length)} locally-modified file(s) under ${args.envDir} would be overwritten:\n${list}`;

  if (args.yes) {
    args.log(`${summary}\noverwriting (--yes)`);
    return "proceed";
  }

  const accepted = await args.confirm(`${summary}\nContinue?`, {
    yes: false,
  });
  return accepted ? "proceed" : "abort";
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
