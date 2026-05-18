import { resolve } from "node:path";

import { isNoEntError } from "~/core/errors.js";
import { hashFile } from "~/shell/manifest/io.js";
import type { Manifest } from "~/shell/manifest/types.js";
import { validateEntryPath } from "./entryPath.js";

type LocalMod = {
  path: string;
  reason: "modified" | "missing-from-disk";
};

export async function detectLocalModifications(
  envDir: string,
  manifest: Manifest,
): Promise<LocalMod[]> {
  const envDirResolved = resolve(envDir);
  const mods: LocalMod[] = [];
  for (const entry of manifest.flows) {
    // Reject absolute paths and `..` segments before touching the filesystem.
    // A malformed/malicious manifest could otherwise hash arbitrary locations.
    const abs = validateEntryPath(entry.path, envDirResolved);
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
    if (actual !== entry.contentHash) {
      mods.push({ path: entry.path, reason: "modified" });
    }
  }
  return mods;
}

type PromptArgs = {
  envDir: string;
  manifest: Manifest;
  yes: boolean;
  // Defaults true; pass false (non-TTY) to get "needs-yes" instead of confirm.
  interactive?: boolean | undefined;
  log: (message: string) => void;
  confirm: (message: string) => Promise<boolean>;
};

export async function promptOverwriteIfModified(
  args: PromptArgs,
): Promise<"proceed" | "abort" | "needs-yes"> {
  const mods = await detectLocalModifications(args.envDir, args.manifest);
  // Don't prompt on "missing-from-disk": a pull restoring a deleted file
  // is the user-evident intent and doesn't need confirmation.
  const modified = mods.filter((m) => m.reason === "modified");
  if (modified.length === 0) return "proceed";

  const list = modified.map((m) => `  - ${m.path}`).join("\n");
  const summary = `${modified.length} locally-modified file(s) under ${args.envDir} would be overwritten:\n${list}`;

  if (args.yes) {
    args.log(`${summary}\noverwriting (--yes)`);
    return "proceed";
  }
  if (args.interactive === false) return "needs-yes";

  const accepted = await args.confirm(`${summary}\nContinue?`);
  return accepted ? "proceed" : "abort";
}
