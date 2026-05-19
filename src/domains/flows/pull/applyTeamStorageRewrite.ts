import { join, relative } from "node:path";

import { readFile, readdir, writeFile } from "~/shell/fs.js";
import { rewriteTeamStorage } from "./rewriteTeamStorage.js";

const sourceExtensions = [".ts", ".js", ".mts", ".cts", ".mjs", ".cjs"];
const flowExtensions = [".flow.ts", ".flow.js"];

function isSourceFile(name: string): boolean {
  return sourceExtensions.some((ext) => name.endsWith(ext));
}

function isFlowFile(name: string): boolean {
  return flowExtensions.some((ext) => name.endsWith(ext));
}

async function walk(dir: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const abs = join(dir, e.name);
    if (e.isDirectory()) {
      await walk(abs, out);
    } else if (e.isFile() && isSourceFile(e.name)) {
      out.push(abs);
    }
  }
}

export async function applyTeamStorageRewrite(
  rootDir: string,
): Promise<{ flowsWithTeamStorageRefs: string[] }> {
  const files: string[] = [];
  await walk(rootDir, files);
  const results = await Promise.all(
    files.map(async (file): Promise<string | undefined> => {
      const source = await readFile(file, "utf8");
      const result = rewriteTeamStorage(source);
      const finalSource = result.rewrites > 0 ? result.source : source;
      if (result.rewrites > 0) {
        await writeFile(file, finalSource, "utf8");
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
