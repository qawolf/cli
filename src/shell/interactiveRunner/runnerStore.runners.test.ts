import { describe, expect, it } from "bun:test";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { makeRunnerStore } from "./runnerStore.js";

const cwd = "/workspace";

function makeStore(): ReturnType<typeof makeRunnerStore> {
  return makeRunnerStore({ cwd, fs: makeMemoryFs() });
}

describe("makeRunnerStore runners", () => {
  it("holds nothing before a launch", async () => {
    expect(await makeStore().readRunners()).toEqual([]);
  });

  it("records the family a runner was launched under", async () => {
    const store = makeStore();

    await store.rememberLaunch({ id: "ci", runnerName: "android" });

    expect(await store.readRunners()).toEqual([
      { id: "ci", runnerName: "android" },
    ]);
  });

  it("holds every runner the workspace launched", async () => {
    const store = makeStore();

    await store.rememberLaunch({ id: "ci" });
    await store.rememberLaunch({ id: "review" });

    expect((await store.readRunners()).map((runner) => runner.id)).toEqual([
      "ci",
      "review",
    ]);
  });

  // Relaunching an id attaches to the runner already there, so it is the same
  // runner and must not be listed twice.
  it("records a relaunched id once, with the family it was relaunched under", async () => {
    const store = makeStore();
    await store.rememberLaunch({ id: "ci", runnerName: "playwright" });

    await store.rememberLaunch({ id: "ci", runnerName: "android" });

    expect(await store.readRunners()).toEqual([
      { id: "ci", runnerName: "android" },
    ]);
  });

  it("drops a runner it was told to forget", async () => {
    const store = makeStore();
    await store.rememberLaunch({ id: "ci" });
    await store.rememberLaunch({ id: "review" });

    await store.forgetRunner("ci");

    expect((await store.readRunners()).map((runner) => runner.id)).toEqual([
      "review",
    ]);
  });

  it("keeps only the runners it is told are still running", async () => {
    const store = makeStore();
    await store.rememberLaunch({ id: "ci" });
    await store.rememberLaunch({ id: "review" });
    await store.rememberLaunch({ id: "scratch" });

    await store.retainRunners(["ci", "scratch"]);

    expect((await store.readRunners()).map((runner) => runner.id)).toEqual([
      "ci",
      "scratch",
    ]);
  });

  // Listing is a read, so it reports what is gone without retargeting the
  // commands that name a runner.
  it("leaves the default alone when pruning the runners it names", async () => {
    const store = makeStore();
    await store.rememberLaunch({ id: "ci" });

    await store.retainRunners([]);

    expect(await store.readRunners()).toEqual([]);
    expect(await store.readDefaultRunnerId()).toBe("ci");
  });

  // A file an older CLI wrote has a default and no runners at all.
  it("reads a file with no runners key as holding none", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir(`${cwd}/.qawolf`, { recursive: true });
    await fs.writeFile(
      `${cwd}/.qawolf/runner.json`,
      '{"defaultRunnerId":"ci"}',
    );
    const store = makeRunnerStore({ cwd, fs });

    expect(await store.readRunners()).toEqual([]);
    expect(await store.readDefaultRunnerId()).toBe("ci");
  });

  it("keeps a default written by an older CLI when a new runner is launched", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir(`${cwd}/.qawolf`, { recursive: true });
    await fs.writeFile(
      `${cwd}/.qawolf/runner.json`,
      '{"defaultRunnerId":"ci"}',
    );
    const store = makeRunnerStore({ cwd, fs });

    await store.rememberLaunch({ id: "review" });

    expect((await store.readRunners()).map((runner) => runner.id)).toEqual([
      "review",
    ]);
    expect(await store.readDefaultRunnerId()).toBe("review");
  });
});
