import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { readManifest, writeManifest } from "~/shell/manifest/io.js";
import { buildManifest } from "./bundle.js";
import { buildBundle } from "./pull.fixtures.js";
import { stageBundle } from "./stage.js";

let workDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-bundle-tags-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

async function stage(names: string[]): Promise<void> {
  for (const name of names) {
    const p = join(workDir, name);
    await mkdir(join(p, ".."), { recursive: true });
    await writeFile(p, "// flow", "utf8");
  }
}

const baseArgs = () => ({
  envId: "env-x",
  bundleDir: workDir,
  cliFlowsVersion: "0.4.0",
  now: new Date("2026-05-10T12:00:00.000Z"),
  envVarsFetchedAt: undefined,
  wrapperName: undefined,
  qawolfCommittedAt: undefined,
  tags: undefined,
});

const entryFor = (
  manifest: Awaited<ReturnType<typeof buildManifest>>,
  path: string,
) => manifest.flows.find((f) => f.path === path);

describe("buildManifest tags", () => {
  it("leaves tags and tagsFetchedAt unset when no tags were fetched", async () => {
    await stage(["src/flows/a.flow.ts"]);

    const manifest = await buildManifest({ ...baseArgs(), tags: undefined });

    expect(manifest.tagsFetchedAt).toBeUndefined();
    expect(
      entryFor(manifest, join("src", "flows", "a.flow.ts"))?.tags,
    ).toBeUndefined();
  });

  it("records the fetched tags against each flow", async () => {
    await stage(["src/flows/a.flow.ts", "src/flows/b.flow.ts"]);

    const manifest = await buildManifest({
      ...baseArgs(),
      tags: {
        fetchedAt: new Date("2026-05-10T12:30:00.000Z"),
        byPath: new Map([
          ["src/flows/a.flow.ts", ["auth"]],
          ["src/flows/b.flow.ts", []],
        ]),
      },
    });

    expect(manifest.tagsFetchedAt).toBe("2026-05-10T12:30:00.000Z");
    expect(entryFor(manifest, join("src", "flows", "a.flow.ts"))?.tags).toEqual(
      ["auth"],
    );
    expect(entryFor(manifest, join("src", "flows", "b.flow.ts"))?.tags).toEqual(
      [],
    );
  });

  // A file in the bundle the tag fetch did not return has unknown tags. It must
  // stay unset rather than defaulting to empty, which would claim it is untagged.
  it("leaves a flow the fetch did not cover unset", async () => {
    await stage(["src/flows/a.flow.ts", "src/flows/missing.flow.ts"]);

    const manifest = await buildManifest({
      ...baseArgs(),
      tags: {
        fetchedAt: new Date("2026-05-10T12:30:00.000Z"),
        byPath: new Map([["src/flows/a.flow.ts", ["auth"]]]),
      },
    });

    expect(entryFor(manifest, join("src", "flows", "a.flow.ts"))?.tags).toEqual(
      ["auth"],
    );
    expect(
      entryFor(manifest, join("src", "flows", "missing.flow.ts"))?.tags,
    ).toBeUndefined();
  });
});

describe("stageBundle tag preservation", () => {
  // A pull rebuilds the manifest from the bundle. Without carrying the
  // previous tags forward, one failed tag fetch erases a good cache and every
  // offline tag query silently stops working.
  it("keeps the previous tags when the fetch failed", async () => {
    const dest = join(workDir, "env");
    const flows = [{ name: "src/flows/a.flow.ts", data: "// a" }];
    const first = join(workDir, "first.tar.gz");
    await buildBundle(first, { flows });

    await stageBundle({
      tmpArchive: first,
      destAbs: dest,
      assetsAbs: join(workDir, "assets"),
      envId: "env-x",
      cliFlowsVersion: "0.4.0",
      now: new Date("2026-05-10T12:00:00.000Z"),
      envVars: {},
      envVarsFetchedAt: new Date("2026-05-10T12:00:00.000Z"),
      tags: {
        fetchedAt: new Date("2026-05-10T12:30:00.000Z"),
        byPath: new Map([["src/flows/a.flow.ts", ["auth"]]]),
      },
    });

    // Second pull, tag fetch failed.
    const second = join(workDir, "second.tar.gz");
    await buildBundle(second, { flows });
    await stageBundle({
      tmpArchive: second,
      destAbs: dest,
      assetsAbs: join(workDir, "assets"),
      envId: "env-x",
      cliFlowsVersion: "0.4.0",
      now: new Date("2026-05-11T12:00:00.000Z"),
      envVars: {},
      envVarsFetchedAt: new Date("2026-05-11T12:00:00.000Z"),
      tags: undefined,
    });

    const manifest = await readManifest(dest);
    if (typeof manifest === "string") throw new Error(manifest);
    expect(manifest.tagsFetchedAt).toBe("2026-05-10T12:30:00.000Z");
    expect(manifest.flows[0]?.tags).toEqual(["auth"]);
  });

  // A manifest written by an older CLI on win32 holds `\` paths. The rebuilt
  // manifest looks entries up by posix path, so the carry must normalize or
  // one failed fetch silently drops every tag while keeping tagsFetchedAt.
  it("carries tags from a manifest that used backslash paths", async () => {
    const dest = join(workDir, "env");
    const flows = [{ name: "src/flows/a.flow.ts", data: "// a" }];
    const first = join(workDir, "first.tar.gz");
    await buildBundle(first, { flows });

    await stageBundle({
      tmpArchive: first,
      destAbs: dest,
      assetsAbs: join(workDir, "assets"),
      envId: "env-x",
      cliFlowsVersion: "0.4.0",
      now: new Date("2026-05-10T12:00:00.000Z"),
      envVars: {},
      envVarsFetchedAt: new Date("2026-05-10T12:00:00.000Z"),
      tags: {
        fetchedAt: new Date("2026-05-10T12:30:00.000Z"),
        byPath: new Map([["src/flows/a.flow.ts", ["auth"]]]),
      },
    });

    const staged = await readManifest(dest);
    if (typeof staged === "string") throw new Error(staged);
    await writeManifest(dest, {
      ...staged,
      flows: staged.flows.map((flow) => ({
        ...flow,
        path: flow.path.replaceAll("/", "\\"),
      })),
    });

    // Second pull, tag fetch failed.
    const second = join(workDir, "second.tar.gz");
    await buildBundle(second, { flows });
    await stageBundle({
      tmpArchive: second,
      destAbs: dest,
      assetsAbs: join(workDir, "assets"),
      envId: "env-x",
      cliFlowsVersion: "0.4.0",
      now: new Date("2026-05-11T12:00:00.000Z"),
      envVars: {},
      envVarsFetchedAt: new Date("2026-05-11T12:00:00.000Z"),
      tags: undefined,
    });

    const manifest = await readManifest(dest);
    if (typeof manifest === "string") throw new Error(manifest);
    expect(manifest.flows[0]?.tags).toEqual(["auth"]);
  });
});
