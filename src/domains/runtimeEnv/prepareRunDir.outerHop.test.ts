import { afterEach, describe, expect, it } from "bun:test";
import { readlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { prepareRunDir } from "./prepareRunDir.js";
import {
  makeProjectTree,
  makeTmpDirTracker,
} from "./runDirFixtures.testUtils.js";
import { scaffoldManagedRuntime } from "./scaffoldManagedRuntime.testUtils.js";

const tracker = makeTmpDirTracker("qawolf-rundir-outerhop-test-");

afterEach(() => tracker.cleanup());

describe("prepareRunDir outer-hop discovery (nested-bundle topology)", () => {
  it("walks past an unsatisfying host node_modules to a satisfying ancestor", async () => {
    const runRoot = await tracker.makeTmpDir();
    const depsRoot = await tracker.makeTmpDir();
    await scaffoldManagedRuntime(depsRoot);

    // world/ has the satisfying node_modules; host/ (simulating the CLI repo)
    // has an unrelated one; bundle/ (projectDir) has none of its own.
    const { root: world, projectDir: bundle } = await makeProjectTree({
      tracker,
      deps: { "date-fns": "2.29.3" },
      projectPath: "host/bundle",
      seed: { "": ["date-fns"], host: ["lodash"] },
    });
    const flowFile = join(bundle, "flow.ts");
    await writeFile(flowFile, "// flow");

    const result = await prepareRunDir({
      files: [flowFile],
      projectDir: bundle,
      depsRoot,
      runRoot,
    });
    tracker.track(result.runDir);

    // The host's node_modules (missing date-fns) must be skipped.
    expect(result.outerHop).toEqual({
      mode: "symlink",
      nodeModulesDir: join(world, "node_modules"),
    });
    expect(await readlink(join(result.runDir, "node_modules"))).toBe(
      join(world, "node_modules"),
    );
  });
});
