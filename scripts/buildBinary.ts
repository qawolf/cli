#!/usr/bin/env bun
// Single source of truth for compiling the standalone binary. Used by the
// build:binary npm script (host build → dist/qawolf) and the release-binaries
// workflow, which passes --target/--outfile to build each platform.
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
  "--external",
  "@qawolf/emails",
  "--external",
  "@qawolf/testkit",
  "--define",
  'process.env.QAWOLF_COMPILED="true"',
];

const result = spawnSync("bun", buildArgs, { stdio: "inherit" });
process.exit(result.status ?? 1);
