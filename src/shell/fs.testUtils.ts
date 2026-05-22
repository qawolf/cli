import type { Fs } from "./fs.js";
import { dirname } from "node:path";

function throwNoEntError(
  path: string,
  kind: "mkdir" | "open" | "rm" | "stat" | "unlink",
): never {
  throw Object.assign(
    new Error(`ENOENT: no such file or directory, ${kind} '${path}'`),
    { code: "ENOENT" },
  );
}

export function makeMemoryFs(): Fs {
  const files = new Map<string, Uint8Array>();
  const dirs = new Set<string>();
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

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
          for (const k of dirs) {
            if (k === path || k.startsWith(prefix)) {
              dirs.delete(k);
            }
          }
        } else {
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
    async writeFile(path, data) {
      const parent = dirname(path);
      if (parent !== "/" && !dirs.has(parent)) throwNoEntError(path, "open");
      files.set(
        path,
        typeof data === "string" ? textEncoder.encode(data) : data,
      );
    },
  };
}
