import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { buildManifest } from "./bundle.js";

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
