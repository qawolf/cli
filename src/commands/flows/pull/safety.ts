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
    let actual: string;
    try {
      actual = await hashFile(abs);
    } catch (err: unknown) {
      if (isNoEntError(err)) {
        mods.push({ path: entry.path, reason: "missing-from-disk" });
        continue;
      }
      throw err;
    }
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
  confirm: (message: string) => Promise<boolean>;
};

export async function promptOverwriteIfModified(
  args: PromptArgs,
): Promise<"proceed" | "abort"> {
  const mods = await detectLocalModifications(args.envDir, args.manifest);
  // Don't prompt on "missing-from-disk": a pull restoring a deleted file
  // is the user-evident intent and doesn't need confirmation.
  const modified = mods.filter((m) => m.reason === "modified");
  if (modified.length === 0) return "proceed";

  const list = modified.map((m) => `  - ${m.path}`).join("\n");
  const summary = `${String(modified.length)} locally-modified file(s) under ${args.envDir} would be overwritten:\n${list}`;

  if (args.yes) {
    args.log(`${summary}\noverwriting (--yes)`);
    return "proceed";
  }

  const accepted = await args.confirm(`${summary}\nContinue?`);
  return accepted ? "proceed" : "abort";
}

function isNoEntError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  );
}
