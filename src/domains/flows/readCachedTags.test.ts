import { describe, expect, it } from "bun:test";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import type { Fs } from "~/shell/fs.js";
import { manifestFilename } from "~/shell/manifest/io.js";
import type { Manifest } from "~/shell/manifest/types.js";

import { readCachedTags } from "./readCachedTags.js";

const envDir = "/proj/.qawolf/staging";
const flowA = `${envDir}/src/flows/a.flow.ts`;
const flowB = `${envDir}/src/flows/b.flow.ts`;

const manifest = (over: Partial<Manifest>): Manifest => ({
  envId: "env-1",
  envSlug: undefined,
  envName: undefined,
  fetchedAt: "2026-05-10T12:00:00.000Z",
  envVarsFetchedAt: undefined,
  cliFlowsVersion: "0.1.0",
  qawolfCommitSha: undefined,
  qawolfCommittedAt: undefined,
  tagsFetchedAt: "2026-05-10T12:00:00.000Z",
  flows: [],
  ...over,
});

async function fsWith(m: Manifest): Promise<Fs> {
  const fs = makeMemoryFs();
  await fs.mkdir(envDir, { recursive: true });
  await fs.writeFile(`${envDir}/${manifestFilename}`, JSON.stringify(m));
  return fs;
}

describe("readCachedTags", () => {
  it("returns nothing for flows outside a pulled env tree", async () => {
    const fs = makeMemoryFs();
    const result = await readCachedTags(["/proj/src/flows/a.flow.ts"], fs);
    expect(result.size).toBe(0);
  });

  it("returns the tags recorded for each flow", async () => {
    const fs = await fsWith(
      manifest({
        flows: [
          { path: "src/flows/a.flow.ts", contentHash: "h1", tags: ["auth"] },
          { path: "src/flows/b.flow.ts", contentHash: "h2", tags: [] },
        ],
      }),
    );

    const result = await readCachedTags([flowA, flowB], fs);

    expect(result.get(flowA)).toEqual(["auth"]);
    expect(result.get(flowB)).toEqual([]);
  });

  // Without tagsFetchedAt the manifest predates tags entirely, so an empty
  // entry means "never fetched", not "untagged".
  it("returns nothing when the manifest never fetched tags", async () => {
    const fs = await fsWith(
      manifest({
        tagsFetchedAt: undefined,
        flows: [
          { path: "src/flows/a.flow.ts", contentHash: "h1", tags: undefined },
        ],
      }),
    );

    const result = await readCachedTags([flowA], fs);

    expect(result.size).toBe(0);
  });

  // A flow on disk the tag fetch did not return has unknown tags, which is
  // not the same as being untagged.
  it("omits a flow whose entry carries no tags", async () => {
    const fs = await fsWith(
      manifest({
        flows: [
          { path: "src/flows/a.flow.ts", contentHash: "h1", tags: ["auth"] },
          { path: "src/flows/b.flow.ts", contentHash: "h2", tags: undefined },
        ],
      }),
    );

    const result = await readCachedTags([flowA, flowB], fs);

    expect(result.has(flowA)).toBe(true);
    expect(result.has(flowB)).toBe(false);
  });

  it("reads the manifest once no matter how many flows share the env", async () => {
    const fs = await fsWith(
      manifest({
        flows: [
          { path: "src/flows/a.flow.ts", contentHash: "h1", tags: ["auth"] },
          { path: "src/flows/b.flow.ts", contentHash: "h2", tags: ["smoke"] },
        ],
      }),
    );
    let reads = 0;
    const counting: Fs = {
      ...fs,
      readFile: (p: string) => {
        reads += 1;
        return fs.readFile(p);
      },
    };

    await readCachedTags([flowA, flowB], counting);

    expect(reads).toBe(1);
  });

  // A manifest written on Windows stores win32 separators. Splitting on the
  // host separator would be a no-op here and the lookup would miss, so the
  // flow's tags would wrongly read as unknown.
  it("matches a manifest written with windows separators", async () => {
    const fs = await fsWith(
      manifest({
        flows: [
          {
            path: "src\\flows\\a.flow.ts",
            contentHash: "h1",
            tags: ["auth"],
          },
        ],
      }),
    );

    const result = await readCachedTags([flowA], fs);

    expect(result.get(flowA)).toEqual(["auth"]);
  });
});
