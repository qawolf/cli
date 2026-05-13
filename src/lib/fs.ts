import { stat } from "node:fs/promises";

import { isNoEntError } from "./errors.js";

export async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch (err) {
    if (isNoEntError(err)) return false;
    throw err;
  }
}
