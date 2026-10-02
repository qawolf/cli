import { relative } from "node:path";

import { isFlowFile, isSourceFile } from "~/core/flowMeta.js";
import { makeDefaultFs } from "~/shell/fs.js";
import type { Fs } from "~/shell/fs.js";
import { walkFiles } from "~/shell/walkFiles.js";

import { rewriteTeamStorage } from "./rewriteTeamStorage.js";

export async function applyTeamStorageRewrite(
  rootDir: string,
  fs: Fs = makeDefaultFs(),
): Promise<{ flowsWithTeamStorageRefs: string[] }> {
  const files = await walkFiles(rootDir, isSourceFile, fs);
  const results = await Promise.all(
    files.map(async (file): Promise<string | undefined> => {
      const source = await fs.readFile(file);
      const result = rewriteTeamStorage(source);
      const finalSource = result.rewrites > 0 ? result.source : source;
      if (result.rewrites > 0) {
        await fs.writeFile(file, finalSource);
      }
      if (
        isFlowFile(file) &&
        finalSource.includes("process.env.TEAM_STORAGE_DIR")
      ) {
        return relative(rootDir, file);
      }
      return undefined;
    }),
  );
  const flowsWithTeamStorageRefs = results
    .filter((p): p is string => p !== undefined)
    .sort();
  return { flowsWithTeamStorageRefs };
}
