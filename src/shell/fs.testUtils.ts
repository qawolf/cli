import type { FsDirent, Fs } from "./fs.js";
import { posix } from "node:path";
import { Readable } from "node:stream";

const dirname = posix.dirname;

// Callers build paths with a literal "/", but the code under test joins with
// node:path, which emits "\" and a drive prefix on win32. Key every entry in
// one POSIX form so both spellings name the same entry.
function toKey(path: string) {
  return path.replace(/\\/g, "/").replace(/^[A-Za-z]:/, "");
}

function throwNoEntError(
  path: string,
  kind: "mkdir" | "open" | "rm" | "stat" | "unlink",
): never {
  throw Object.assign(
    new Error(`ENOENT: no such file or directory, ${kind} '${path}'`),
    { code: "ENOENT" },
  );
}

function throwNotDirError(path: string, syscall: string): never {
  throw Object.assign(
    new Error(`ENOTDIR: not a directory, ${syscall} '${path}'`),
    { code: "ENOTDIR" },
  );
}

export function makeMemoryFs(): Fs {
  const files = new Map<string, Uint8Array>();
  const dirs = new Set<string>(["/"]);
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  function joinPath(dir: string, name: string) {
    return dir === "/" ? `/${name}` : `${dir}/${name}`;
  }

  function addParents(filePath: string) {
    let dir = dirname(filePath);
    while (dir !== "." && dir !== "/") {
      dirs.add(dir);
      dir = dirname(dir);
    }
    if (dir === "/") dirs.add(dir);
  }

  function childNames(path: string) {
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
  function requireParent(
    path: string,
    rawPath: string,
    kind: "mkdir" | "open",
  ) {
    const parent = dirname(path);
    if (parent !== "/" && !dirs.has(parent)) throwNoEntError(rawPath, kind);
  }

  return {
    async mkdir(rawPath, opts) {
      const path = toKey(rawPath);
      if (!opts?.recursive) requireParent(path, rawPath, "mkdir");
      dirs.add(path);
      if (opts?.recursive) addParents(path);
    },
    async pathExists(rawPath) {
      const path = toKey(rawPath);
      return files.has(path) || dirs.has(path);
    },
    async readFile(rawPath: string) {
      const data = files.get(toKey(rawPath));
      if (data === undefined) throwNoEntError(rawPath, "open");
      return textDecoder.decode(data);
    },
    async rm(rawPath, opts) {
      const path = toKey(rawPath);
      if (files.has(path)) {
        files.delete(path);
        return;
      }
      if (dirs.has(path)) {
        if (opts?.recursive) {
          const prefix = path + "/";
          for (const k of files.keys()) {
            if (k.startsWith(prefix)) {
              files.delete(k);
            }
          }
          for (const k of Array.from(dirs)) {
            if (k === path || k.startsWith(prefix)) {
              dirs.delete(k);
            }
          }
        } else {
          const prefix = path + "/";
          const hasChildren =
            [...files.keys()].some((k) => k.startsWith(prefix)) ||
            [...dirs].some((d) => d.startsWith(prefix));
          if (hasChildren) {
            throw Object.assign(
              new Error(`ENOTEMPTY: directory not empty, rmdir '${path}'`),
              { code: "ENOTEMPTY" },
            );
          }
          dirs.delete(path);
        }
        return;
      }
      if (!opts?.force) throwNoEntError(rawPath, "rm");
    },
    async stat(rawPath) {
      const path = toKey(rawPath);
      const isFile = files.has(path);
      const isDir = dirs.has(path);
      if (!isFile && !isDir) throwNoEntError(rawPath, "stat");
      return {
        isFile: () => isFile,
        isDirectory: () => isDir,
        size: isFile ? (files.get(path)?.length ?? 0) : 0,
        mtimeMs: 0,
        mtime: new Date(0),
      };
    },
    async unlink(rawPath) {
      const path = toKey(rawPath);
      if (!files.has(path)) throwNoEntError(rawPath, "unlink");
      files.delete(path);
    },
    async writeFile(rawPath, data, _options) {
      const path = toKey(rawPath);
      requireParent(path, rawPath, "open");
      files.set(
        path,
        typeof data === "string" ? textEncoder.encode(data) : data,
      );
    },
    readdir(rawPath) {
      const path = toKey(rawPath);
      if (files.has(path)) throwNotDirError(rawPath, "scandir");
      if (!dirs.has(path)) throwNoEntError(rawPath, "open");
      return Promise.resolve(childNames(path));
    },
    readdirWithTypes(rawPath) {
      const path = toKey(rawPath);
      if (files.has(path)) throwNotDirError(rawPath, "scandir");
      if (!dirs.has(path)) throwNoEntError(rawPath, "open");
      return Promise.resolve<FsDirent[]>(
        childNames(path).map((name) => {
          const fullPath = joinPath(path, name);
          const isFileSnapshot = files.has(fullPath);
          const isDirSnapshot = dirs.has(fullPath);
          return {
            name,
            isFile: () => isFileSnapshot,
            isDirectory: () => isDirSnapshot,
          };
        }),
      );
    },
    rename(rawOldPath, rawNewPath) {
      const oldPath = toKey(rawOldPath);
      const newPath = toKey(rawNewPath);
      if (files.has(oldPath)) {
        requireParent(newPath, rawNewPath, "open");
        files.set(newPath, files.get(oldPath)!);
        files.delete(oldPath);
        return Promise.resolve();
      }
      if (dirs.has(oldPath)) {
        requireParent(newPath, rawNewPath, "open");
        const oldPrefix = oldPath + "/";
        const newPrefix = newPath + "/";
        dirs.delete(oldPath);
        dirs.add(newPath);
        for (const key of Array.from(files.keys())) {
          if (key.startsWith(oldPrefix)) {
            files.set(newPrefix + key.slice(oldPrefix.length), files.get(key)!);
            files.delete(key);
          }
        }
        for (const d of Array.from(dirs)) {
          if (d.startsWith(oldPrefix)) {
            dirs.delete(d);
            dirs.add(newPrefix + d.slice(oldPrefix.length));
          }
        }
        return Promise.resolve();
      }
      throwNoEntError(rawOldPath, "open");
    },
    utimes(_path, _atime, _mtime) {
      return Promise.resolve();
    },
    createReadStream(rawPath) {
      const data = files.get(toKey(rawPath));
      if (data === undefined) throwNoEntError(rawPath, "open");
      return Readable.from([data]);
    },
    async copyFile(rawSource, rawDestination) {
      const destination = toKey(rawDestination);
      const data = files.get(toKey(rawSource));
      if (data === undefined) throwNoEntError(rawSource, "open");
      requireParent(destination, rawDestination, "open");
      files.set(destination, data.slice());
    },
    existsSync(rawPath) {
      const path = toKey(rawPath);
      return files.has(path) || dirs.has(path);
    },
    readFileSync(rawPath) {
      const data = files.get(toKey(rawPath));
      if (data === undefined) throwNoEntError(rawPath, "open");
      return textDecoder.decode(data);
    },
    writeFileSync(rawPath, data) {
      const path = toKey(rawPath);
      requireParent(path, rawPath, "open");
      files.set(path, textEncoder.encode(data));
    },
    mkdirSync(rawPath, opts) {
      const path = toKey(rawPath);
      if (!opts?.recursive) requireParent(path, rawPath, "mkdir");
      dirs.add(path);
      if (opts?.recursive) addParents(path);
    },
  };
}
