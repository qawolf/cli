import { describe, expect, it } from "bun:test";

import { makeConsoleHarness as make } from "./reporter.testUtils.js";

const sampleStamp = {
  envId: "env-abc",
  path: "src/login.flow.ts",
  contentHash:
    "f4b3f6bf75f348feb3865afd3555b654bd3e2b46e115b3f16f28d546b49063f9",
};

describe("createConsoleReporter manifest stamp", () => {
  it("onFlowPass writes a stamp line when manifest is present", () => {
    const { out, r } = make();
    r.onFlowPass?.({
      name: "F",
      path: "p",
      tests: { passed: 1, total: 1 },
      durationMs: 200,
      manifest: sampleStamp,
    });
    const s = out.calls.join("");
    expect(s).toContain("env=env-abc");
    expect(s).toContain("hash=f4b3f6bf");
  });

  it("onFlowPass omits the stamp line when manifest is undefined", () => {
    const { out, r } = make();
    r.onFlowPass?.({
      name: "F",
      path: "p",
      tests: { passed: 1, total: 1 },
      durationMs: 200,
    });
    expect(out.calls.join("")).not.toContain("env=");
  });

  it("onFlowFail writes a stamp line when manifest is present", () => {
    const { out, r } = make();
    r.onFlowFail?.({
      name: "F",
      path: "p",
      err: new Error("fail"),
      tests: { passed: 0, total: 1 },
      durationMs: 300,
      attempt: 1,
      maxAttempts: 1,
      manifest: sampleStamp,
    });
    const s = out.calls.join("");
    expect(s).toContain("env=env-abc");
    expect(s).toContain("hash=f4b3f6bf");
  });
});
