import { describe, expect, it } from "bun:test";

import { notFoundSubject } from "./notFoundSubject.js";

describe("notFoundSubject", () => {
  it("reads the runner id off a route relayed to one runner", () => {
    expect(notFoundSubject("runner.takeScreenshot", { id: "agent-1" })).toEqual(
      { kind: "runner", runnerId: "agent-1" },
    );
  });

  // Launching creates a runner and listing names none, so neither can 404 over
  // a runner that has gone.
  it.each(["runner.launch", "runner.list"])(
    "does not read %s as a missing runner",
    (contractName) => {
      expect(notFoundSubject(contractName, { id: "agent-1" }).kind).not.toBe(
        "runner",
      );
    },
  );

  it("reads the run id off a route that resolves one run", () => {
    expect(notFoundSubject("run.get", { runId: "abc" })).toEqual({
      kind: "run",
      runId: "abc",
    });
  });

  it("reads a request that names an environment as environment-scoped", () => {
    expect(notFoundSubject("run.create", { environmentId: "env-1" })).toEqual({
      kind: "environment",
    });
    expect(
      notFoundSubject("environment.get", { environmentId: "env-1" }),
    ).toEqual({ kind: "environment" });
  });

  // The bug this replaces: a trigger or an issue that does not exist was
  // reported as an environment problem.
  it("leaves a request that names no environment unattributed", () => {
    expect(notFoundSubject("trigger.get", { triggerId: "t-1" })).toEqual({
      kind: "other",
    });
  });

  it("survives an input that is not an object", () => {
    expect(notFoundSubject("runner.inspect", undefined)).toEqual({
      kind: "runner",
      runnerId: undefined,
    });
  });
});
