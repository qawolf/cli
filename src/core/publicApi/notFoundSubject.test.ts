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

  it.each([
    ["trigger.get", { triggerId: "trg-1" }, "trigger", "trg-1"],
    ["issue.get", { issueId: "iss-1" }, "issue", "iss-1"],
    ["flow.update", { flowId: "flw-1" }, "flow", "flw-1"],
    ["agent.get", { sessionId: "ses-1" }, "session", "ses-1"],
    [
      "file.requestDownload",
      { filePath: "logs/out.txt" },
      "file",
      "logs/out.txt",
    ],
  ] as const)(
    "names the record %s resolves",
    (contractName, input, noun, id) => {
      expect(notFoundSubject(contractName, input)).toEqual({
        id,
        kind: "record",
        noun,
      });
    },
  );

  // The record is what was not found; the environment it was looked up in is
  // beside the point, and blaming it is the bug this family of fixes is about.
  it("names the record even when the request also scoped an environment", () => {
    expect(
      notFoundSubject("trigger.update", {
        environmentId: "env-1",
        triggerId: "trg-1",
      }),
    ).toEqual({ id: "trg-1", kind: "record", noun: "trigger" });
  });

  // An id the route takes as a parameter is not the thing being resolved.
  it("ignores the workspace and the ids a route only takes as arguments", () => {
    expect(notFoundSubject("tag.list", { workspaceId: "wsp-1" })).toEqual({
      kind: "other",
    });
    expect(
      notFoundSubject("trigger.create", {
        environmentId: "env-1",
        timezoneId: "UTC",
      }),
    ).toEqual({ kind: "environment" });
  });

  it("survives an input that is not an object", () => {
    expect(notFoundSubject("runner.inspect", undefined)).toEqual({
      kind: "runner",
      runnerId: undefined,
    });
  });
});
