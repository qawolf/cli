import { describe, expect, it } from "bun:test";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { makeRunnerStore } from "./runnerStore.js";

const cwd = "/workspace";

/**
 * One filesystem, two stores: the faithful model of two `qawolf runner`
 * commands running in the same directory at once.
 */
function makeTwoStores(): [
  ReturnType<typeof makeRunnerStore>,
  ReturnType<typeof makeRunnerStore>,
] {
  const fs = makeMemoryFs();
  return [makeRunnerStore({ cwd, fs }), makeRunnerStore({ cwd, fs })];
}

describe("makeRunnerStore under concurrent commands", () => {
  it("keeps both runners when two launches land together", async () => {
    const [first, second] = makeTwoStores();

    await Promise.all([
      first.rememberLaunch({ id: "alpha" }),
      second.rememberLaunch({ id: "beta" }),
    ]);

    const ids = (await first.readRunners()).map((runner) => runner.id).sort();
    expect(ids).toEqual(["alpha", "beta"]);
  });

  it("keeps the surviving runner when a launch and a forget land together", async () => {
    const [first, second] = makeTwoStores();
    await first.rememberLaunch({ id: "alpha" });

    await Promise.all([
      first.rememberLaunch({ id: "beta" }),
      second.forgetRunner("alpha"),
    ]);

    const ids = (await first.readRunners()).map((runner) => runner.id);
    expect(ids).toEqual(["beta"]);
  });

  it("takes over a lock a dead process left behind", async () => {
    const fs = makeMemoryFs();
    const store = makeRunnerStore({ cwd, fs });
    await fs.mkdir("/workspace/.qawolf", { recursive: true });
    await fs.mkdir("/workspace/.qawolf/runner.json.lock");
    await fs.writeFile(
      "/workspace/.qawolf/runner.json.lock/heldSince",
      String(Date.now() - 60_000),
    );

    await store.rememberLaunch({ id: "alpha" });

    expect((await store.readRunners()).map((runner) => runner.id)).toEqual([
      "alpha",
    ]);
  });

  it("keeps every runner when many launches land together", async () => {
    const fs = makeMemoryFs();
    const ids = ["a", "b", "c", "d", "e"];

    await Promise.all(
      ids.map((id) => makeRunnerStore({ cwd, fs }).rememberLaunch({ id })),
    );

    const stored = (await makeRunnerStore({ cwd, fs }).readRunners())
      .map((runner) => runner.id)
      .sort();
    expect(stored).toEqual(ids);
  });
});
