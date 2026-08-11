import { posix } from "node:path";

const dirname = posix.dirname;

// Callers build paths with a literal "/", but the code under test joins with
// node:path, which emits "\" and a drive prefix on win32. Key every entry in
// one POSIX form so both spellings name the same entry.
export function toKey(path: string): string {
  return path.replace(/\\/g, "/").replace(/^[A-Za-z]:/, "");
}

export function throwNoEntError(
  path: string,
  kind: "mkdir" | "open" | "rm" | "stat" | "unlink",
): never {
  throw Object.assign(
    new Error(`ENOENT: no such file or directory, ${kind} '${path}'`),
    { code: "ENOENT" },
  );
}

export function throwNotDirError(path: string, syscall: string): never {
  throw Object.assign(
    new Error(`ENOTDIR: not a directory, ${syscall} '${path}'`),
    { code: "ENOTDIR" },
  );
}

export function joinPath(dir: string, name: string): string {
  return dir === "/" ? `/${name}` : `${dir}/${name}`;
}

export function addParents(dirs: Set<string>, filePath: string): void {
  let dir = dirname(filePath);
  while (dir !== "." && dir !== "/") {
    dirs.add(dir);
    dir = dirname(dir);
  }
  if (dir === "/") dirs.add(dir);
}

export function childNames(
  files: ReadonlyMap<string, Uint8Array>,
  dirs: ReadonlySet<string>,
  path: string,
): string[] {
  const prefix = path === "/" ? "/" : path + "/";
  const names = new Set<string>();
  for (const f of files.keys()) {
    if (f.startsWith(prefix)) {
      const segment = f.slice(prefix.length).split("/")[0];
      if (segment) names.add(segment);
    }
  }
  for (const d of dirs) {
    if (d !== path && d.startsWith(prefix)) {
      const rel = d.slice(prefix.length);
      if (!rel.includes("/")) names.add(rel);
    }
  }
  return [...names];
}

// `rawPath` is only for the error message, so it echoes the caller's spelling.
export function requireParent(
  dirs: ReadonlySet<string>,
  path: string,
  rawPath: string,
  kind: "mkdir" | "open",
): void {
  const parent = dirname(path);
  if (parent !== "/" && !dirs.has(parent)) throwNoEntError(rawPath, kind);
}
