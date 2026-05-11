import { isAbsolute, posix, resolve, sep } from "node:path";

export function validateEntryPath(name: string, destResolved: string): string {
  if (!name) throw new Error("empty entry name");
  if (
    isAbsolute(name) ||
    name.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(name)
  ) {
    throw new Error(`path traversal: absolute entry path (${name})`);
  }
  const normalized = posix.normalize(name);
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`path traversal: entry escapes destination (${name})`);
  }
  const target = resolve(destResolved, name);
  if (target !== destResolved && !target.startsWith(destResolved + sep)) {
    throw new Error(
      `path traversal: entry resolves outside destination (${name})`,
    );
  }
  return target;
}
