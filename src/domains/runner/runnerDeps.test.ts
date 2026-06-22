import { describe, expect, it } from "bun:test";
import { createRunnerDeps } from "./runnerDeps.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

describe("createRunnerDeps", () => {
  it("resolves exitCode to -1 when the binary is missing instead of crashing on an unhandled error event", async () => {
    const deps = createRunnerDeps(makeNoopSignals(), "/tmp/deps");
    const { exitCode } = deps.spawn("__qawolf_nonexistent_binary_xyzzy__", []);
    expect(await exitCode).toBe(-1);
  });

  it("resolves exitCode with the child's exit code on a normal close", async () => {
    const deps = createRunnerDeps(makeNoopSignals(), "/tmp/deps");
    const { exitCode } = deps.spawn(process.execPath, [
      "-e",
      "process.exit(7)",
    ]);
    expect(await exitCode).toBe(7);
  });

  it("includes the provided depsRoot in the returned deps", () => {
    const deps = createRunnerDeps(makeNoopSignals(), "/tmp/my-deps-root");
    expect(deps.depsRoot).toBe("/tmp/my-deps-root");
  });
});
