import { createReadStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import {
  copyFile,
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
  copyFile,
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
