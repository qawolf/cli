import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { adbBin } from "~/core/androidBins.js";

const execFileAsync = promisify(execFile);

export type AdbFn = (args: string[]) => Promise<{ stdout: string }>;

export const defaultAdb: AdbFn = async (args) => {
  const home = process.env["ANDROID_HOME"] ?? process.env["ANDROID_SDK_ROOT"];
  const { stdout } = await execFileAsync(adbBin(home, process.platform), args);
  return { stdout };
};
