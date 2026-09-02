#!/usr/bin/env bun
// Builds the npm bundle, dist/cli.js (--outdir because bun rejects --sourcemap=external with --outfile).
import { spawnSync } from "node:child_process";

// Runtime dependencies stay external — npm installs them next to dist/cli.js.
const externals = [
  // native addon — cannot be inlined into a JS bundle
  "@napi-rs/keyring",
  // native-addon TS loader, imported only on the Node path (Node <22.18) to
  // transpile/resolve flows; the Bun binary never loads it
  "@oxc-node/core",
  // version-coupled: playwright must match @qawolf/flows' peer range at runtime
  "@qawolf/flow-targets",
  "@qawolf/flows",
  "playwright",
  "playwright-core",
  // installed on demand by ensureDeps (also external in the binary — see buildBinary.ts)
  "@qawolf/emails",
  "@qawolf/testkit",
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
