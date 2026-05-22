import * as fs from "node:fs";
import { createReadStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  rmdir,
  stat,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises";

import { isNoEntError } from "~/core/errors.js";

export {
  createReadStream,
  existsSync,
  mkdir,
  mkdirSync,
  readFile,
  readFileSync,
  readdir,
  rename,
  rm,
  rmdir,
  stat,
  unlink,
  utimes,
  writeFile,
};

export async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch (err) {
    if (isNoEntError(err)) return false;
    throw err;
  }
}

/** @public */
export type Fs = {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  pathExists(path: string): Promise<boolean>;
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  rm(
    path: string,
    options?: { recursive?: boolean; force?: boolean },
  ): Promise<void>;
  stat(path: string): Promise<fs.Stats>;
  unlink(path: string): Promise<void>;
  writeFile(path: string, data: string | Uint8Array): Promise<void>;
};

/** @public */
export function makeDefaultFs(): Fs {
  return {
    async mkdir(path, options) {
      await fs.promises.mkdir(path, options);
    },
    pathExists,
    readFile(path, encoding) {
      return fs.promises.readFile(path, encoding);
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
    async writeFile(path, data) {
      if (typeof data === "string") {
        await fs.promises.writeFile(path, data, "utf8");
      } else {
        await fs.promises.writeFile(path, data);
      }
    },
  };
}
