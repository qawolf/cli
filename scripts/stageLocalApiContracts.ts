#!/usr/bin/env bun
// Stages an unpublished @qawolf/api-contracts build into node_modules so the
// CLI can be developed against contracts that exist only in the platform
// checkout. Delete-and-replace: `bun install` restores the published copy.
//
//   bun run stage:api-contracts [path/to/platform]
//   QAWOLF_PLATFORM_PATH=... bun run stage:api-contracts
//
// The compile runs with *this* repo's TypeScript and resolves `zod` from *this*
// repo's node_modules, so the staged package shares the CLI's single zod
// instance. A symlink to the platform checkout would not: Node resolves a
// symlinked module from its real path, so its `zod` would come from the
// platform's own tree and schemas built there would be foreign to the ones the
// CLI validates and introspects with.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const packageSubPath = "packages-published-public/api-contracts";

const platformPath = resolve(
  process.argv[2] ?? process.env["QAWOLF_PLATFORM_PATH"] ?? "../platform",
);
const sourcePath = join(platformPath, packageSubPath);
const sourceSrcPath = join(sourcePath, "src");
if (!existsSync(sourceSrcPath)) {
  console.error(
    `No @qawolf/api-contracts source at ${sourceSrcPath}.\nPass the platform checkout path, or set QAWOLF_PLATFORM_PATH.`,
  );
  process.exit(1);
}

const cliPath = resolve(import.meta.dirname, "..");
const stagedPath = join(cliPath, "node_modules/@qawolf/api-contracts");

rmSync(stagedPath, { force: true, recursive: true });
mkdirSync(stagedPath, { recursive: true });
copyFileSync(
  join(sourcePath, "package.json"),
  join(stagedPath, "package.json"),
);

// --ignoreConfig so this repo's tsconfig.json does not apply; the flags mirror
// the platform's own build settings for this package.
const compile = spawnSync(
  "npx",
  [
    "tsc",
    "--ignoreConfig",
    "--declaration",
    "--erasableSyntaxOnly",
    "--lib",
    "es2024",
    "--module",
    "nodenext",
    "--moduleResolution",
    "nodenext",
    "--outDir",
    join(stagedPath, "dist"),
    "--rootDir",
    sourceSrcPath,
    "--skipLibCheck",
    "--strict",
    "--target",
    "es2022",
    // Named rather than left to discovery: the sources are outside this repo, so
    // tsc looks for @types beside them and finds none, and the package uses
    // Buffer.
    "--types",
    "node",
    "--verbatimModuleSyntax",
    join(sourceSrcPath, "index.ts"),
  ],
  { cwd: cliPath, stdio: "inherit" },
);
if (compile.status !== 0) process.exit(compile.status ?? 1);

console.log(`Staged @qawolf/api-contracts from ${sourcePath}`);
