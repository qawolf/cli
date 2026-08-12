import { describe, expect, it } from "bun:test";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { makeRunnerStore } from "./runnerStore.js";

const cwd = "/workspace";

function makeStore(): ReturnType<typeof makeRunnerStore> {
  return makeRunnerStore({ cwd, fs: makeMemoryFs() });
}

describe("makeRunnerStore", () => {
  it("has no default before one is written", async () => {
    expect(await makeStore().readDefaultRunnerId()).toBeUndefined();
  });

  it("reads back the runner it was given", async () => {
    const store = makeStore();

    await store.writeDefaultRunnerId("ci");

    expect(await store.readDefaultRunnerId()).toBe("ci");
  });

  it("replaces an earlier default", async () => {
    const store = makeStore();

    await store.writeDefaultRunnerId("ci");
    await store.writeDefaultRunnerId("review");

    expect(await store.readDefaultRunnerId()).toBe("review");
  });

  it("has no default after clearing", async () => {
    const store = makeStore();
    await store.writeDefaultRunnerId("ci");

    await store.clearDefaultRunnerId();

    expect(await store.readDefaultRunnerId()).toBeUndefined();
  });

  it("clearing a store that has nothing in it is not an error", async () => {
    await makeStore().clearDefaultRunnerId();
  });

  // Each write keeps its own temp file, so one write's rename cannot pull the
  // other's out from under it. The first write is held open until the second
  // has finished, so the two genuinely overlap.
  it("survives two writes in flight at once", async () => {
    const fs = makeMemoryFs();
    let holdFirstWrite: (() => void) | undefined;
    const overlappingFs: typeof fs = {
      ...fs,
      async writeFile(path, data, options) {
        await fs.writeFile(path, data, options);
        if (holdFirstWrite === undefined && path.endsWith(".tmp")) {
          await new Promise<void>((resolve) => {
            holdFirstWrite = resolve;
          });
        }
      },
    };
    const store = makeRunnerStore({ cwd, fs: overlappingFs });

    const first = store.writeDefaultRunnerId("first");
    await store.writeDefaultRunnerId("second");
    holdFirstWrite?.();
    await first;

    expect(await store.readDefaultRunnerId()).toBe("first");
  });

  // A stale cache file is not a reason to refuse to run: the caller's next step
  // is to launch a runner either way.
  it("reads unparseable contents as no default", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir(`${cwd}/.qawolf`, { recursive: true });
    await fs.writeFile(`${cwd}/.qawolf/runner.json`, "{ truncated");

    expect(
      await makeRunnerStore({ cwd, fs }).readDefaultRunnerId(),
    ).toBeUndefined();
  });
});
