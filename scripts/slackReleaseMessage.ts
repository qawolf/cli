#!/usr/bin/env bun
// Reads `gh release view --json body,url,tagName[,assets]` JSON on stdin and
// prints a Slack chat.postMessage (--phase publish) or chat.update
// (--phase binaries --ts <ts>) payload. Used by .github/workflows/release.yml.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { buildSlackPayload, parseReleaseInput } from "./slackReleaseBlocks.js";

const usage =
  "usage: slackReleaseMessage.ts --phase publish|binaries --channel <id> [--ts <message ts>]";

const { values } = parseArgs({
  options: {
    phase: { type: "string" },
    channel: { type: "string" },
    ts: { type: "string" },
  },
});
const { phase, channel, ts } = values;

if ((phase !== "publish" && phase !== "binaries") || !channel) {
  console.error(usage);
  process.exit(1);
}
if (phase === "binaries" && !ts) {
  console.error(`--phase binaries requires --ts\n${usage}`);
  process.exit(1);
}

const release = parseReleaseInput(JSON.parse(readFileSync(0, "utf8")));
console.log(JSON.stringify(buildSlackPayload({ release, phase, channel, ts })));
