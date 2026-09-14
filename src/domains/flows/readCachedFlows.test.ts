import { describe, expect, it } from "bun:test";

import type { Fs } from "~/shell/fs.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { manifestFilename } from "~/shell/manifest/io.js";
import {
  makeManifest,
  makeManifestFlow,
} from "~/shell/manifest/manifest.testUtils.js";
import type { Manifest } from "~/shell/manifest/types.js";

import { readCachedFlows } from "./readCachedFlows.js";

const envDir = "/proj/.qawolf/staging";
const flowA = `${envDir}/src/flows/a.flow.ts`;
const flowB = `${envDir}/src/flows/b.flow.ts`;
const fetchedAt = "2026-05-10T12:00:00.000Z";

async function fsWith(manifest: Manifest): Promise<Fs> {
  const fs = makeMemoryFs();
  await fs.mkdir(envDir, { recursive: true });
  await fs.writeFile(`${envDir}/${manifestFilename}`, JSON.stringify(manifest));
  return fs;
}

describe("readCachedFlows", () => {
  it("returns what the pull recorded for each flow", async () => {
    const fs = await fsWith(
      makeManifest({
        tagsFetchedAt: fetchedAt,
        flows: [
          makeManifestFlow({
            path: "src/flows/a.flow.ts",
            tags: ["smoke"],
            flowId: "flow-a",
          }),
          makeManifestFlow({
            path: "src/flows/b.flow.ts",
            tags: [],
          }),
        ],
      }),
    );

    const result = await readCachedFlows([flowA, flowB], fs);

    expect(result.get(flowA)).toEqual({
      tags: ["smoke"],
      flowId: "flow-a",
    });
    expect(result.get(flowB)).toEqual({
      tags: [],
      flowId: undefined,
    });
  });

  // Older manifests leave IDs unknown.
  it("leaves what the pull did not record undefined", async () => {
    const fs = await fsWith(makeManifest({ flows: [makeManifestFlow()] }));

    const result = await readCachedFlows([flowA], fs);

    expect(result.get(flowA)).toEqual({
      tags: undefined,
      flowId: undefined,
    });
  });

  it("treats tags as unknown until a fetch has succeeded", async () => {
    const fs = await fsWith(
      makeManifest({ flows: [makeManifestFlow({ tags: ["smoke"] })] }),
    );

    const result = await readCachedFlows([flowA], fs);

    expect(result.get(flowA)?.tags).toBeUndefined();
  });

  it("omits a flow that is not in the manifest", async () => {
    const fs = await fsWith(makeManifest({ flows: [makeManifestFlow()] }));

    const result = await readCachedFlows([flowA, flowB], fs);

    expect(result.has(flowB)).toBe(false);
  });

  it("returns nothing for flows outside a pulled env tree", async () => {
    const result = await readCachedFlows(
      ["/proj/src/flows/a.flow.ts"],
      makeMemoryFs(),
    );

    expect(result.size).toBe(0);
  });

  it("returns nothing when the manifest is unreadable", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir(envDir, { recursive: true });
    await fs.writeFile(`${envDir}/${manifestFilename}`, "not json");

    const result = await readCachedFlows([flowA], fs);

    expect(result.size).toBe(0);
  });
});
