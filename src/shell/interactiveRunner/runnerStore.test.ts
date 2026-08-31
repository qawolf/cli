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

  it("has no default after forgetting the runner it named", async () => {
    const store = makeStore();
    await store.rememberLaunch({ id: "ci" });

    await store.forgetRunner("ci");

    expect(await store.readDefaultRunnerId()).toBeUndefined();
  });

  // Ending one runner must not retarget the commands aimed at another.
  it("keeps the default when a different runner is forgotten", async () => {
    const store = makeStore();
    await store.rememberLaunch({ id: "ci" });
    await store.rememberLaunch({ id: "review" });

    await store.forgetRunner("ci");

    expect(await store.readDefaultRunnerId()).toBe("review");
  });

  it("forgetting from a store that has nothing in it is not an error", async () => {
    await makeStore().forgetRunner("ci");
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
