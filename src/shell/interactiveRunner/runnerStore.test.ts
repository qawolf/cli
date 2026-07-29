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
