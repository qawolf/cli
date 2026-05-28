import type { FsDirent, Fs } from "./fs.js";
import { dirname } from "node:path";
import { Readable } from "node:stream";

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

  return {
    async mkdir(path, opts) {
      if (!opts?.recursive) {
        const parent = dirname(path);
        if (parent !== "/" && !dirs.has(parent)) throwNoEntError(path, "mkdir");
      }
      dirs.add(path);
      if (opts?.recursive) addParents(path);
    },
    async pathExists(path) {
      return files.has(path) || dirs.has(path);
    },
    async readFile(path: string) {
      const data = files.get(path);
      if (data === undefined) throwNoEntError(path, "open");
      return textDecoder.decode(data);
    },
    async rm(path, opts) {
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
      if (!opts?.force) throwNoEntError(path, "rm");
    },
    async stat(path) {
      const isFile = files.has(path);
      const isDir = dirs.has(path);
      if (!isFile && !isDir) throwNoEntError(path, "stat");
      return {
        isFile: () => isFile,
        isDirectory: () => isDir,
        size: isFile ? (files.get(path)?.length ?? 0) : 0,
        mtimeMs: 0,
        mtime: new Date(0),
      };
    },
    async unlink(path) {
      if (!files.has(path)) throwNoEntError(path, "unlink");
      files.delete(path);
    },
    async writeFile(path, data, _options) {
      const parent = dirname(path);
      if (parent !== "/" && !dirs.has(parent)) throwNoEntError(path, "open");
      files.set(
        path,
        typeof data === "string" ? textEncoder.encode(data) : data,
      );
    },
    readdir(path) {
      if (files.has(path)) throwNotDirError(path, "scandir");
      if (!dirs.has(path)) throwNoEntError(path, "open");
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
      return Promise.resolve([...names]);
    },
    readdirWithTypes(path) {
      if (files.has(path)) throwNotDirError(path, "scandir");
      if (!dirs.has(path)) throwNoEntError(path, "open");
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
      return Promise.resolve<FsDirent[]>(
        [...names].map((name) => {
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
    rename(oldPath, newPath) {
      if (files.has(oldPath)) {
        const parent = dirname(newPath);
        if (parent !== "/" && !dirs.has(parent))
          throwNoEntError(newPath, "open");
        files.set(newPath, files.get(oldPath)!);
        files.delete(oldPath);
        return Promise.resolve();
      }
      if (dirs.has(oldPath)) {
        const parent = dirname(newPath);
        if (parent !== "/" && !dirs.has(parent))
          throwNoEntError(newPath, "open");
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
      throwNoEntError(oldPath, "open");
    },
    utimes(_path, _atime, _mtime) {
      return Promise.resolve();
    },
    createReadStream(path) {
      const data = files.get(path);
      if (data === undefined) throwNoEntError(path, "open");
      return Readable.from([data]);
    },
    existsSync(path) {
      return files.has(path) || dirs.has(path);
    },
    readFileSync(path) {
      const data = files.get(path);
      if (data === undefined) throwNoEntError(path, "open");
      return textDecoder.decode(data);
    },
    mkdirSync(path, opts) {
      if (!opts?.recursive) {
        const parent = dirname(path);
        if (parent !== "/" && !dirs.has(parent)) throwNoEntError(path, "mkdir");
      }
      dirs.add(path);
      if (opts?.recursive) addParents(path);
    },
  };
}
