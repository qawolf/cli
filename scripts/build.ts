#!/usr/bin/env bun
// Builds the npm-distribution bundle (dist/cli.js; postbuild.sh prepends the
// node shebang). Every external below is a runtime dependency npm installs
// next to dist/cli.js, so bundling it would only duplicate code. Uses --outdir
// because bun rejects --sourcemap=external with --outfile.
import { spawnSync } from "node:child_process";

const externals = [
  // native platform addon — cannot be inlined into a JS bundle
  "@napi-rs/keyring",
  // version-coupled at runtime: playwright is pinned to @qawolf/flows' peer
  // range and flows are executed against the installed copies, which must win
  // over anything baked into the bundle
  "@qawolf/flow-targets",
  "@qawolf/flows",
  "playwright",
  "playwright-core",
  // installed on demand into the flow env cache by ensureDeps; also the only
  // two kept external in the standalone binary (see scripts/buildBinary.ts)
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
