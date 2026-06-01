import type { Readable } from "node:stream";
import * as fs from "node:fs";

import { isNoEntError } from "~/core/errors.js";

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.promises.stat(p);
    return true;
  } catch (err) {
    if (isNoEntError(err)) return false;
    throw err;
  }
}

type FsStat = Pick<
  fs.Stats,
  "isFile" | "isDirectory" | "size" | "mtimeMs" | "mtime"
>;

export type FsDirent = {
  name: string;
  isFile(): boolean;
  isDirectory(): boolean;
};

export type Fs = {
  mkdir(
    path: string,
    options?: { recursive?: boolean; mode?: number },
  ): Promise<void>;
  pathExists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  rm(
    path: string,
    options?: { recursive?: boolean; force?: boolean },
  ): Promise<void>;
  stat(path: string): Promise<FsStat>;
  unlink(path: string): Promise<void>;
  writeFile(
    path: string,
    data: string | Uint8Array,
    options?: { mode?: number },
  ): Promise<void>;
  readdir(path: string): Promise<string[]>;
  readdirWithTypes(path: string): Promise<FsDirent[]>;
  rename(oldPath: string, newPath: string): Promise<void>;
  utimes(path: string, atime: Date, mtime: Date): Promise<void>;
  createReadStream(path: string): Readable;
  copyFile(source: string, destination: string): Promise<void>;
  existsSync(path: string): boolean;
  readFileSync(path: string): string; // always UTF-8
  writeFileSync(path: string, data: string): void; // always UTF-8
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
};

export function makeDefaultFs(): Fs {
  return {
    async mkdir(path, options) {
      await fs.promises.mkdir(path, options);
    },
    pathExists,
    readFile(path) {
      return fs.promises.readFile(path, "utf-8");
    },
    async rm(path, options) {
      await fs.promises.rm(path, options);
    },
    stat(path) {
      return fs.promises.stat(path);
    },
    async unlink(path) {
      await fs.promises.unlink(path);
    },
    async writeFile(path, data, options) {
      if (typeof data === "string") {
        await fs.promises.writeFile(path, data, {
          encoding: "utf8",
          mode: options?.mode,
        });
      } else {
        await fs.promises.writeFile(path, data, options ?? undefined);
      }
    },
    readdir(path) {
      return fs.promises.readdir(path);
    },
    readdirWithTypes(path) {
      // fs.promises.readdir returns Dirent[]; cast satisfies Fs's FsDirent[] return
      return fs.promises.readdir(path, {
        withFileTypes: true,
      }) as Promise<FsDirent[]>;
    },
    rename(oldPath, newPath) {
      return fs.promises.rename(oldPath, newPath);
    },
    utimes(path, atime, mtime) {
      return fs.promises.utimes(path, atime, mtime);
    },
    createReadStream(path) {
      // Pre-check so missing-file throws synchronously, matching makeMemoryFs contract
      if (!fs.existsSync(path)) {
        const err = Object.assign(
          new Error(`ENOENT: no such file or directory, open '${path}'`),
          { code: "ENOENT", errno: -2 },
        );
        throw err;
      }
      return fs.createReadStream(path);
    },
    async copyFile(source, destination) {
      await fs.promises.copyFile(source, destination);
    },
    existsSync(path) {
      return fs.existsSync(path);
    },
    readFileSync(path) {
      return fs.readFileSync(path, "utf-8");
    },
    writeFileSync(path, data) {
      fs.writeFileSync(path, data, "utf8");
    },
    mkdirSync(path, options) {
      fs.mkdirSync(path, options);
    },
  };
}
