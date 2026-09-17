import { describe, expect, it } from "bun:test";

import { exitCodes } from "~/shell/exit.js";

import { runnerRequestFailure } from "./runnerRequestFailure.js";

const notRunning = {
  error: "Runner agent-1 is not running (HTTP 404).",
  errorBody: "It was never launched, or it has since been terminated.",
  exitCode: exitCodes.notFound,
};

describe("runnerRequestFailure", () => {
  // A transcript that only says which runner was missed leaves a reader unable
  // to tell what to go and change.
  it.each([
    ["flag", "The id agent-1 came from --runner."],
    ["environment", "The id agent-1 came from QAWOLF_RUNNER_ID."],
    ["stored", "recorded in .qawolf"],
    ["launched", "Runner agent-1 was launched for this command."],
    ["given", "The id agent-1 is the one this call named."],
  ] as const)("says a %s id was what chose the runner", (source, expected) => {
    const failure = runnerRequestFailure(notRunning, {
      runnerId: "agent-1",
      source,
    });

    expect(failure.errorBody).toContain(expected);
  });

  it("keeps the explanation the platform layer built", () => {
    const failure = runnerRequestFailure(notRunning, {
      runnerId: "agent-1",
      source: "flag",
    });

    expect(failure.errorBody).toContain("It was never launched");
    expect(failure.error).toBe(notRunning.error);
  });

  // Exits `notFound` rather than `network` so a caller can stop instead of
  // retrying an id no amount of waiting brings back.
  it("exits not-found rather than network", () => {
    expect(
      runnerRequestFailure(notRunning, { runnerId: "agent-1", source: "flag" })
        .exitCode,
    ).toBe(exitCodes.notFound);
  });

  it("says where the id came from even when the platform gave no reason", () => {
    const failure = runnerRequestFailure(
      { error: notRunning.error, exitCode: exitCodes.notFound },
      { runnerId: "agent-1", source: "environment" },
    );

    expect(failure.errorBody).toBe(
      "The id agent-1 came from QAWOLF_RUNNER_ID.",
    );
  });

  it("leaves an unreachable platform as a network failure", () => {
    const failure = runnerRequestFailure(
      { error: "Could not reach the QA Wolf API." },
      { runnerId: "agent-1", source: "flag" },
    );

    expect(failure).toEqual({
      error: "Could not reach the QA Wolf API.",
      exitCode: exitCodes.network,
    });
  });

  it("keeps an exit code the platform layer already mapped", () => {
    const failure = runnerRequestFailure(
      { error: "rejected", exitCode: exitCodes.auth },
      { runnerId: "agent-1", source: "flag" },
    );

    expect(failure.exitCode).toBe(exitCodes.auth);
  });
});
