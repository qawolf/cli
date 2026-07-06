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

const buildArgs = [
  "build",
  "./src/main.ts",
  "--outdir",
  "dist",
  "--entry-naming=cli.[ext]",
  "--target",
  "node",
  ...externals.flatMap((pkg) => ["--external", pkg]),
  "--sourcemap=external",
];

const result = spawnSync("bun", buildArgs, { stdio: "inherit" });
process.exit(result.status ?? 1);
