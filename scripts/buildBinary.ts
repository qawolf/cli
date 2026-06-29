#!/usr/bin/env bun
// Compiles the standalone binary (default dist/qawolf); the release-binaries workflow passes --target/--outfile per platform.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    target: { type: "string" },
    outfile: { type: "string", default: "dist/qawolf" },
  },
});

// Generate the compile entry in dist/ (excluded from tsc + knip): it embeds the
// already-built dist/cli.js as a Bun file asset, exports its extracted path via
// env, then runs the CLI from source. Generated rather than kept in src/ so
// neither tsc (which cannot model the file-asset import) nor knip (which cannot
// see a string-arg entry) trips on it. cli.js is the same bundle the runner
// spawns as a BUN_BE_BUN worker so flows resolve their own node_modules —
// including native modules like sharp — at runtime, which the in-process
// compiled resolver cannot. Never bundled into cli.js (build.ts builds
// src/main.ts), so there is no embed cycle.
const entryPath = "dist/binary-entry.ts";
writeFileSync(
  entryPath,
  [
    'import cliAsset from "./cli.js" with { type: "file" };',
    "",
    "process.env.QAWOLF_EMBEDDED_CLI_PATH = cliAsset;",
    "",
    'await import("../src/main.ts");',
    "",
  ].join("\n"),
);

const buildArgs = [
  "build",
  "--compile",
  ...(values.target ? [`--target=${values.target}`] : []),
  entryPath,
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
