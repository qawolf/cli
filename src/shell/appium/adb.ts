import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { adbBin } from "~/core/androidBins.js";
import { androidSdkHome } from "~/shell/androidSdkHome.js";

const execFileAsync = promisify(execFile);

export type AdbFn = (args: string[]) => Promise<{ stdout: string }>;

export const defaultAdb: AdbFn = async (args) => {
  const { stdout } = await execFileAsync(
    adbBin(androidSdkHome(), process.platform),
    args,
  );
  return { stdout };
};
