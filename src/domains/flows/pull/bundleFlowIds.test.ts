import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { readManifest } from "~/shell/manifest/io.js";
import { buildManifest } from "./bundle.js";
import { buildBundle } from "./pull.fixtures.js";
import { stageBundle } from "./stage.js";

let workDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-bundle-flow-ids-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

const flow = "src/flows/a.flow.ts";

const baseArgs = () => ({
  flowIds: undefined,
  envId: "env-x",
  envSlug: undefined,
  envName: undefined,
  bundleDir: workDir,
  cliFlowsVersion: "0.4.0",
  now: new Date("2026-05-10T12:00:00.000Z"),
  envVarsFetchedAt: undefined,
  wrapperName: undefined,
  qawolfCommittedAt: undefined,
  tags: undefined,
});

async function stage(names: string[]): Promise<void> {
  for (const name of names) {
    const p = join(workDir, name);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, "// flow", "utf8");
  }
}

describe("buildManifest flow ids", () => {
  it("records the id the listing gave each flow", async () => {
    await stage([flow]);

    const manifest = await buildManifest({
      ...baseArgs(),
      flowIds: new Map([[flow, "flow-a"]]),
    });

    expect(manifest.flows.find((f) => f.path === flow)?.flowId).toBe("flow-a");
  });

  it("leaves a flow the listing did not cover without an id", async () => {
    await stage([flow]);

    const manifest = await buildManifest({ ...baseArgs(), flowIds: new Map() });

    expect(manifest.flows.find((f) => f.path === flow)?.flowId).toBeUndefined();
  });
});

describe("stageBundle flow ids", () => {
  const stageArgs = (destDir: string, archive: string) => ({
    flowIds: undefined,
    tmpArchive: archive,
    destAbs: destDir,
    assetsAbs: join(destDir, "..", "assets"),
    envId: "env-abc",
    envSlug: undefined,
    envName: undefined,
    cliFlowsVersion: "0.4.0",
    now: new Date("2026-05-10T12:00:00.000Z"),
    envVars: {},
    envVarsFetchedAt: new Date("2026-05-10T12:00:00.000Z"),
    tags: undefined,
  });

  // A failed listing fetch must not erase ids a previous pull stored — the
  // same guarantee tags have.
  it("carries ids forward when the listing could not be fetched", async () => {
    const destDir = join(workDir, "env");
    const first = join(workDir, "first.tar.gz");
    await buildBundle(first, { flows: [{ name: flow, data: "// a" }] });
    await stageBundle({
      ...stageArgs(destDir, first),
      flowIds: new Map([[flow, "flow-a"]]),
    });

    const second = join(workDir, "second.tar.gz");
    await buildBundle(second, {
      flows: [{ name: flow, data: "// a, edited" }],
    });
    await stageBundle({ ...stageArgs(destDir, second), flowIds: undefined });

    const manifest = await readManifest(destDir);
    if (typeof manifest === "string") throw new Error(manifest);
    expect(manifest.flows.find((f) => f.path === flow)?.flowId).toBe("flow-a");
  });
});
