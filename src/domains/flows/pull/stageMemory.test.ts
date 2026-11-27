import { expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { readManifest } from "~/shell/manifest/io.js";

import { buildBundle } from "./pull.fixtures.js";
import { stageBundle } from "./stage.js";

it("stages and analyzes a bundle using the supplied filesystem", async () => {
  const workDir = await mkdtemp(join(tmpdir(), "stage-memory-"));
  try {
    const archive = join(workDir, "bundle.tar.gz");
    await buildBundle(archive, {
      flows: [
        {
          name: "src/a.flow.ts",
          data: 'import { read } from "./read.js"; export default () => read();',
        },
        {
          name: "src/read.ts",
          data: "export function read() { return process.env.TOKEN; }",
        },
      ],
    });
    const fs = makeMemoryFs();
    await fs.mkdir("/work", { recursive: true });
    await fs.writeFile("/work/bundle.tar.gz", await readFile(archive));
    const result = await stageBundle(
      {
        tmpArchive: "/work/bundle.tar.gz",
        destAbs: "/work/env",
        assetsAbs: "/work/assets",
        envId: "env",
        envSlug: undefined,
        envName: undefined,
        cliFlowsVersion: "1.0.0",
        now: new Date(0),
        envVars: {},
        envVarsFetchedAt: new Date(0),
        tags: undefined,
      },
      fs,
    );
    expect(result.flowCount).toBe(1);
    expect(result.missingEnvVars).toEqual([{ name: "TOKEN", flowCount: 1 }]);
    expect(result.incompleteFlowCount).toBe(0);
    const manifest = await readManifest("/work/env", fs);
    if (typeof manifest === "string") throw new Error(manifest);
    expect(manifest.flows[0]?.envVars).toEqual(["TOKEN"]);
    expect(manifest.flows[0]?.envVarsMayBeIncomplete).toBe(false);
    expect(await fs.pathExists("/work/env/src/a.flow.ts")).toBe(true);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});
