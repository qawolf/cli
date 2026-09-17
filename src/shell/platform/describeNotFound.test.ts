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
      expect(described.errorBody).toContain(
        "qawolf runner launch --id agent-1",
      );
      expect(described.errorBody).toContain("--runner");
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

      expect(described.errorBody).toContain(
        "It was never launched, or it has since been terminated or idled out.",
      );
    });

    // Apex answers "<Noun> not found" on several routes, which repeats the
    // status rather than explaining it.
    it.each(["Not found", "Runner not found", "runner not found."])(
      "treats %p as no reason at all",
      (bare) => {
        const described = describeNotFound(runner, "runner.runFlow", bare);

        expect(described.error).toBe(
          "Runner agent-1 is not running (HTTP 404).",
        );
        expect(described.errorBody).toContain("It was never launched");
      },
    );

    it("prefers the server's reason when it has one", () => {
      const described = describeNotFound(
        runner,
        "runner.runFlow",
        "Runner agent-1 was terminated 4 minutes ago.",
      );

      expect(described.error).toBe(
        "Runner agent-1 was terminated 4 minutes ago. (HTTP 404)",
      );
      expect(described.errorBody).not.toContain("It was never launched");
    });

    // Launching is the fix whatever the reason turns out to be.
    it("still offers the launch command when the server explained", () => {
      const described = describeNotFound(
        runner,
        "runner.runFlow",
        "Runner agent-1 was terminated 4 minutes ago.",
      );

      expect(described.errorBody).toBe(
        "Launch it with qawolf runner launch --id agent-1, or send this to a different runner with --runner.",
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
    // A run that is still being created also answers 404, and that one clears
    // by waiting. Guessing "the id is runner-local" over the top of the
    // platform saying so would send a caller to the wrong fix.
    it("says nothing of its own once the platform has explained", () => {
      const described = describeNotFound(
        { kind: "run", runId: "abc" },
        "run.get",
        "Run is still being created. Try again in a few seconds.",
      );

      expect(described.error).toBe(
        "Run is still being created. Try again in a few seconds. (HTTP 404)",
      );
      expect("errorBody" in described).toBe(false);
    });
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

  describe("a record the platform does not hold", () => {
    it("names the record and the id, not the endpoint", () => {
      const described = describeNotFound(
        { id: "trg-1", kind: "record", noun: "trigger" },
        "trigger.get",
        bareNotFound,
      );

      expect(described.error).toBe("QA Wolf has no trigger trg-1 (HTTP 404).");
      expect(described.exitCode).toBe(exitCodes.notFound);
      expect("errorBody" in described).toBe(false);
    });
  });

  describe("a request with nothing to name", () => {
    // "could not find tag.list" read as though the endpoint were gone.
    it("says the request matched nothing", () => {
      const described = describeNotFound(
        { kind: "other" },
        "tag.list",
        bareNotFound,
      );

      expect(described.error).toBe(
        "QA Wolf found nothing matching the tag.list request (HTTP 404).",
      );
      expect(described.error).not.toContain("environment");
    });
  });
});
