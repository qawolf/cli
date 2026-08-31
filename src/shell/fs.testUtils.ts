import type { FsDirent, Fs } from "./fs.js";
import { Readable } from "node:stream";

import {
  addParents,
  childNames,
  joinPath,
  requireParent,
  throwExistsError,
  throwNoEntError,
  throwNotDirError,
  toKey,
} from "./memoryFsTree.testUtils.js";

export function makeMemoryFs(): Fs {
  const files = new Map<string, Uint8Array>();
  const dirs = new Set<string>(["/"]);
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  return {
    async mkdir(rawPath, opts) {
      const path = toKey(rawPath);
      if (!opts?.recursive) {
        requireParent(dirs, path, rawPath, "mkdir");
        if (dirs.has(path) || files.has(path))
          throwExistsError(rawPath, "mkdir");
      }
      dirs.add(path);
      if (opts?.recursive) addParents(dirs, path);
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
      requireParent(dirs, path, rawPath, "open");
      files.set(
        path,
        typeof data === "string" ? textEncoder.encode(data) : data,
      );
    },
    async openWriteHandle(rawPath) {
      const path = toKey(rawPath);
      requireParent(dirs, path, rawPath, "open");
      files.set(path, new Uint8Array(0));
      return {
        async write(chunk) {
          const existing = files.get(path) ?? new Uint8Array(0);
          const grown = new Uint8Array(existing.length + chunk.length);
          grown.set(existing, 0);
          grown.set(chunk, existing.length);
          files.set(path, grown);
        },
        async close() {},
      };
    },
    readdir(rawPath) {
      const path = toKey(rawPath);
      if (files.has(path)) throwNotDirError(rawPath, "scandir");
      if (!dirs.has(path)) throwNoEntError(rawPath, "open");
      return Promise.resolve(childNames(files, dirs, path));
    },
    readdirWithTypes(rawPath) {
      const path = toKey(rawPath);
      if (files.has(path)) throwNotDirError(rawPath, "scandir");
      if (!dirs.has(path)) throwNoEntError(rawPath, "open");
      return Promise.resolve<FsDirent[]>(
        childNames(files, dirs, path).map((name) => {
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
        requireParent(dirs, newPath, rawNewPath, "open");
        files.set(newPath, files.get(oldPath)!);
        files.delete(oldPath);
        return Promise.resolve();
      }
      if (dirs.has(oldPath)) {
        requireParent(dirs, newPath, rawNewPath, "open");
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
      requireParent(dirs, destination, rawDestination, "open");
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
      requireParent(dirs, path, rawPath, "open");
      files.set(path, textEncoder.encode(data));
    },
    mkdirSync(rawPath, opts) {
      const path = toKey(rawPath);
      if (!opts?.recursive) requireParent(dirs, path, rawPath, "mkdir");
      dirs.add(path);
      if (opts?.recursive) addParents(dirs, path);
    },
  };
}
