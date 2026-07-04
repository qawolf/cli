import { existsSync } from "node:fs";
import { join } from "node:path";

import { spawnCli } from "./spawnCli.js";
import type { Channel, ChannelName } from "./types.js";

/**
 * Builds both CLI artifacts once and returns run-by-reference channels. The
 * `build:binary` script also runs `build`, producing dist/cli.js AND
 * dist/qawolf in a single pass, so only one build runs regardless of which
 * channels are requested. The harness runs under bun, so the node channel
 * spawns the real `node` binary (not process.execPath, which is bun).
 */
export async function resolveChannels(
  channelNames: readonly ChannelName[],
): Promise<Channel[]> {
  const repoRoot = process.cwd();
  const result = await spawnCli("bun", ["run", "build:binary"], {
    cwd: repoRoot,
    env: process.env,
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `build:binary failed (exit ${result.exitCode}):\n${result.stderr}`,
    );
  }
  const absCliJs = join(repoRoot, "dist", "cli.js");
  const absQawolf = join(repoRoot, "dist", "qawolf");
  assertArtifact(absCliJs);
  assertArtifact(absQawolf);
  return channelNames.map((name) => buildChannel(name, absCliJs, absQawolf));
}

function assertArtifact(path: string): void {
  if (!existsSync(path)) {
    throw new Error(`Expected build artifact missing: ${path}`);
  }
}

function buildChannel(
  name: ChannelName,
  absCliJs: string,
  absQawolf: string,
): Channel {
  if (name === "node") {
    return { label: "node", command: "node", prefixArgs: [absCliJs] };
  }
  return { label: "binary", command: absQawolf, prefixArgs: [] };
}
