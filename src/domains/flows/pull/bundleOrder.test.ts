import { expect, it } from "bun:test";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { buildManifest } from "./bundle.js";

it("sorts manifest paths after normalizing separators", async () => {
  const fs = makeMemoryFs();
  await fs.mkdir("/bundle/a", { recursive: true });
  await fs.writeFile("/bundle/a/z.flow.ts", "export default () => 1;");
  await fs.writeFile("/bundle/a[.flow.ts", "export default () => 2;");
  const manifest = await buildManifest(
    {
      bundleDir: "/bundle",
      envId: "env",
      cliFlowsVersion: "1.0.0",
      now: new Date(0),
      envVarsFetchedAt: undefined,
      wrapperName: undefined,
      qawolfCommittedAt: undefined,
      tags: undefined,
      flowIds: undefined,
    },
    {
      ...fs,
      readdirWithTypes: async () =>
        ["a\\z.flow.ts", "a[.flow.ts"].map((name) => ({
          name,
          isFile: () => true,
          isDirectory: () => false,
        })),
    },
  );
  expect(manifest.flows.map(({ path }) => path)).toEqual([
    "a/z.flow.ts",
    "a[.flow.ts",
  ]);
});
