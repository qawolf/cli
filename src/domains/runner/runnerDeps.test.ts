import { describe, expect, it } from "bun:test";
import { createRunnerDeps } from "./runnerDeps.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

describe("createRunnerDeps", () => {
  it("includes the provided depsRoot in the returned deps", () => {
    const deps = createRunnerDeps(makeNoopSignals(), "/tmp/my-deps-root");
    expect(deps.depsRoot).toBe("/tmp/my-deps-root");
  });
});
