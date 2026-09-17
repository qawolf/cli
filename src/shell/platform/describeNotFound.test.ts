import { describe, expect, it } from "bun:test";

import { exitCodes } from "~/shell/exit.js";

import { describeNotFound } from "./describeNotFound.js";

// What apex answers today, before WIZ-12139 names the missing runner.
const bareNotFound = "Not found";

describe("describeNotFound", () => {
  describe("a runner that is not running", () => {
    const runner = { kind: "runner", runnerId: "agent-1" } as const;

    it("names the runner and how to bring one back", () => {
      const described = describeNotFound(runner, "runner.runFlow", "");

      expect(described.error).toContain("Runner agent-1 is not running");
      expect(described.error).toContain("qawolf runner launch --id agent-1");
      expect(described.error).toContain("--runner");
      expect(described.exitCode).toBe(exitCodes.notFound);
    });

    it("never blames the environment", () => {
      const described = describeNotFound(runner, "runner.runFlow", "");

      expect(described.error).not.toContain("--env");
      expect(described.error).not.toContain("environment");
    });

    // An old server answers a bare "Not found", which repeats the status and
    // crowds out the wording a reader can act on.
    it("explains itself when the server said only that it was not found", () => {
      const described = describeNotFound(
        runner,
        "runner.runFlow",
        bareNotFound,
      );

      expect(described.errorBody).toBe(
        "It was never launched, or it has since been terminated or idled out.",
      );
    });

    it("prefers the server's reason when it has one", () => {
      const described = describeNotFound(
        runner,
        "runner.runFlow",
        "Runner agent-1 was terminated 4 minutes ago.",
      );

      expect(described.errorBody).toBe(
        "Runner agent-1 was terminated 4 minutes ago.",
      );
    });

    it("still reads as a missing runner when no id reached it", () => {
      const described = describeNotFound(
        { kind: "runner", runnerId: undefined },
        "runner.runFlow",
        "",
      );

      expect(described.error).toContain("not running");
      expect(described.exitCode).toBe(exitCodes.notFound);
    });
  });

  describe("a run the platform does not hold", () => {
    it("says the id may be one only the runner knows", () => {
      const described = describeNotFound(
        { kind: "run", runId: "abc" },
        "run.get",
        bareNotFound,
      );

      expect(described.error).toContain("no run abc on this team");
      expect(described.errorBody).toContain("qawolf runner run");
      expect(described.errorBody).toContain(
        "qawolf runner events run-status --run abc",
      );
    });
  });

  // The one place the old wording was true.
  describe("a request scoped to an environment", () => {
    it("keeps pointing at --env", () => {
      const described = describeNotFound(
        { kind: "environment" },
        "run.create",
        "",
      );

      expect(described.error).toContain("Check the --env value");
    });

    it("answers a caller that named no subject the same way", () => {
      const described = describeNotFound(undefined, "env-vars", "");

      expect(described.error).toContain("Check the --env value");
    });
  });

  describe("anything else", () => {
    it("names what was asked for without blaming an environment", () => {
      const described = describeNotFound(
        { kind: "other" },
        "trigger.get",
        bareNotFound,
      );

      expect(described.error).toBe(
        "QA Wolf API could not find trigger.get (HTTP 404).",
      );
      expect("errorBody" in described).toBe(false);
    });
  });
});
