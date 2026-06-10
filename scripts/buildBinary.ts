#!/usr/bin/env bun
// Compiles the standalone binary (default dist/qawolf); the release-binaries workflow passes --target/--outfile per platform.
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    target: { type: "string" },
    outfile: { type: "string", default: "dist/qawolf" },
  },
});

const buildArgs = [
  "build",
  "--compile",
  ...(values.target ? [`--target=${values.target}`] : []),
  "./src/main.ts",
  "--outfile",
  values.outfile,
  // unlike the npm bundle (build.ts), only these stay external — ensureDeps installs them on demand
  "--external",
  "@qawolf/emails",
  "--external",
  "@qawolf/testkit",
  "--define",
  'process.env.QAWOLF_COMPILED="true"',
];

const result = spawnSync("bun", buildArgs, { stdio: "inherit" });
process.exit(result.status ?? 1);
