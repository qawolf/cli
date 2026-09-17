import { join } from "node:path";

import { rewriteAliasImports } from "~/core/aliasImports/rewriteAliasImports.js";
import {
  type ParsedTsconfigContent,
  parseTsconfigContent,
} from "~/core/aliasImports/tsconfigPaths.js";
import { batchMap, flowBatchSize } from "~/core/batchMap.js";
import { isNoEntError } from "~/core/errors.js";
import type { Fs } from "~/shell/fs.js";

const skippedDirs = new Set(["node_modules", ".git", ".qawolf"]);
const sourceExtensions = [".ts", ".js"];

export type RewriteStagedAliasesArgs = {
  execDir: string;
  fs: Fs;
  onTsconfigUnparsed?: () => void;
};

export async function rewriteStagedAliases(
  args: RewriteStagedAliasesArgs,
): Promise<string[]> {
  const tsconfig = await readStagedTsconfig(args);
  if (tsconfig.type === "unparseable") {
    args.onTsconfigUnparsed?.();
    return [];
  }
  if (tsconfig.type === "absent" || tsconfig.paths === undefined) return [];
  const tsconfigPaths = tsconfig.paths;

  const stagedPaths = await listStagedSourceFiles({
    dir: args.execDir,
    fs: args.fs,
    prefix: "",
  });
  const projectFilePaths = new Set(stagedPaths);
  const aliasPrefixes = Object.keys(tsconfigPaths).map(
    (pattern) => pattern.split("*")[0] ?? pattern,
  );
  const mentionsAnAlias = (code: string) =>
    aliasPrefixes.some((prefix) => code.includes(prefix));
  const { default: typescript } = await import("typescript");

  const rewriteOne = async (
    stagedPath: string,
  ): Promise<string | undefined> => {
    const absolutePath = join(args.execDir, stagedPath);
    const code = await args.fs.readFile(absolutePath);
    if (!mentionsAnAlias(code)) return undefined;

    const rewritten = rewriteAliasImports({
      code,
      importingFilePath: stagedPath,
      projectFilePaths,
      tsconfigPaths,
      typescript,
    });
    if (rewritten === code) return undefined;

    await args.fs.writeFile(absolutePath, rewritten);
    return stagedPath;
  };

  const rewrittenPaths: string[] = [];
  for await (const stagedPath of batchMap(
    stagedPaths,
    rewriteOne,
    flowBatchSize,
  )) {
    if (stagedPath !== undefined) rewrittenPaths.push(stagedPath);
  }
  return rewrittenPaths;
}

type StagedTsconfig = ParsedTsconfigContent | { type: "absent" };

async function readStagedTsconfig(options: {
  execDir: string;
  fs: Fs;
}): Promise<StagedTsconfig> {
  let content: string;
  try {
    content = await options.fs.readFile(join(options.execDir, "tsconfig.json"));
  } catch (err) {
    if (isNoEntError(err)) return { type: "absent" };
    throw err;
  }
  return parseTsconfigContent(content);
}

async function listStagedSourceFiles(options: {
  dir: string;
  fs: Fs;
  prefix: string;
}): Promise<string[]> {
  const entries = await options.fs.readdirWithTypes(options.dir);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      if (skippedDirs.has(entry.name)) return [];
      const stagedPath =
        options.prefix === "" ? entry.name : `${options.prefix}/${entry.name}`;

      if (entry.isDirectory()) {
        return listStagedSourceFiles({
          dir: join(options.dir, entry.name),
          fs: options.fs,
          prefix: stagedPath,
        });
      }
      const isSource = sourceExtensions.some((extension) =>
        entry.name.endsWith(extension),
      );
      return entry.isFile() && isSource ? [stagedPath] : [];
    }),
  );
  return nested.flat();
}
