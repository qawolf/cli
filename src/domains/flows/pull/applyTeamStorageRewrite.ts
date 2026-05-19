import { join } from "node:path";

import { readFile, readdir, writeFile } from "~/shell/fs.js";
import { rewriteTeamStorage } from "./rewriteTeamStorage.js";

const sourceExtensions = [".ts", ".js", ".mts", ".cts", ".mjs", ".cjs"];

function isSourceFile(name: string): boolean {
  return sourceExtensions.some((ext) => name.endsWith(ext));
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

export async function applyTeamStorageRewrite(rootDir: string): Promise<void> {
  const files: string[] = [];
  await walk(rootDir, files);
  await Promise.all(
    files.map(async (file) => {
      const source = await readFile(file, "utf8");
      const result = rewriteTeamStorage(source);
      if (result.rewrites === 0) return;
      await writeFile(file, result.source, "utf8");
    }),
  );
}
