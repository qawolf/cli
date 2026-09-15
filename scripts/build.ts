#!/usr/bin/env bun
// Builds the npm bundle, dist/cli.js (--outdir because bun rejects --sourcemap=external with --outfile).
import { spawnSync } from "node:child_process";

// Runtime dependencies stay external — npm installs them next to dist/cli.js.
// The compiled binary runs web flows in a worker subprocess that executes this
// bundle from a directory with no node_modules (src/shell/embeddedWorkerCli.ts),
// so every external must be reached through a dynamic import(), never at
// startup. test/worker/importSmoke.mjs runs the bundle that way; a startup
// import of any of these fails every flow the binary runs, as @napi-rs/keyring
// did in 1.29.0. @qawolf/flow-targets is inlined for the same reason: pure and
// imported at startup by core/flowMeta.
const externals = [
  // native addon — cannot be inlined into a JS bundle
  "@napi-rs/keyring",
  // native-addon TS loader, imported only on the Node path (Node <22.18) to
  // transpile/resolve flows; the Bun binary never loads it
  "@oxc-node/core",
  // version-coupled: playwright must match @qawolf/flows' peer range at runtime
  "@qawolf/flows",
  "playwright",
  "playwright-core",
  // installed on demand by ensureDeps (also external in the binary — see buildBinary.ts)
  "@qawolf/emails",
  "@qawolf/testkit",
  // the TypeScript compiler, loaded lazily by the import-graph walk; inlined,
  // Node parses all of it on every command start
  "typescript",
  // loaded from the run's dependency root at runtime (loadWebdriverio); only
  // the compiled binary, a separate build, takes the bare specifier
  "webdriverio",
];

function buildArgs(entry: string, name: string): string[] {
  return [
    "build",
    entry,
    "--outdir",
    "dist",
    `--entry-naming=${name}.[ext]`,
    "--target",
    "node",
    ...externals.flatMap((pkg) => ["--external", pkg]),
    "--sourcemap=external",
  ];
}

const bundles = [
  buildArgs("./src/main.ts", "cli"),
  buildArgs("./src/runnerSdk/index.ts", "runner-sdk"),
];

for (const args of bundles) {
  const result = spawnSync("bun", args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const types = spawnSync("bunx", ["tsc", "-p", "tsconfig.types.json"], {
  stdio: "inherit",
});
process.exit(types.status ?? 1);
