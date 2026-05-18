import { isAbsolute, posix, relative, resolve } from "node:path";

export function validateEntryPath(name: string, destResolved: string): string {
  if (!name) throw new Error("empty entry name");
  if (
    isAbsolute(name) ||
    name.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(name)
  ) {
    throw new Error(`path traversal: absolute entry path (${name})`);
  }
  // Tar entry paths use `/` per ustar convention; normalize as POSIX so the
  // `../` check below works regardless of host OS.
  const normalized = posix.normalize(name);
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`path traversal: entry escapes destination (${name})`);
  }
  const target = resolve(destResolved, name);
  const rel = relative(destResolved, target);
  // `rel` is "" when target === destResolved, starts with ".." when target
  // escapes destResolved, or is absolute when they're on different drives
  // (Windows). Anything else means target is safely inside destResolved.
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(
      `path traversal: entry resolves outside destination (${name})`,
    );
  }
  return target;
}
