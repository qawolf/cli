import { describe, expect, it } from "bun:test";

import {
  formatJournalLine,
  formatRunLogLine,
  readRunSettlement,
} from "./journal.js";

const entry = {
  payload: { message: "clicked Sign in" },
  recordedAt: "2026-07-30T00:00:00.000Z",
  sequence: 7,
};

describe("formatJournalLine", () => {
  it("prints the payload alone by default", () => {
    expect(formatJournalLine(entry, { envelope: false })).toBe(
      '{"message":"clicked Sign in"}',
    );
  });

  it("prints the whole envelope when asked", () => {
    expect(JSON.parse(formatJournalLine(entry, { envelope: true }))).toEqual(
      entry,
    );
  });
});

describe("readRunSettlement", () => {
  it("reads an in-progress run as still running", () => {
    expect(
      readRunSettlement({ runId: "run-a", status: "in-progress" }),
    ).toEqual({ type: "in-progress" });
  });

  it("reads a passed run as settled with no error", () => {
    expect(readRunSettlement({ runId: "run-a", status: "passed" })).toEqual({
      errorMessage: undefined,
      status: "passed",
      type: "settled",
    });
  });

  it("reads a failed run as settled with its reason", () => {
    expect(
      readRunSettlement({
        errorMessage: "expected 3 to be 4",
        runId: "run-a",
        status: "failed",
      }),
    ).toEqual({
      errorMessage: "expected 3 to be 4",
      status: "failed",
      type: "settled",
    });
  });

  // A terminal status added later must still end a follow rather than leave it
  // polling for an ending it has already been told about.
  it("reads an unfamiliar terminal status as settled, keeping its name", () => {
    expect(readRunSettlement({ runId: "run-a", status: "abandoned" })).toEqual({
      errorMessage: undefined,
      status: "abandoned",
      type: "settled",
    });
  });

  it("reads a payload of the wrong shape as unreadable", () => {
    expect(readRunSettlement({ state: "done" })).toEqual({
      type: "unreadable",
    });
  });
});

describe("formatRunLogLine", () => {
  it("prints the message of a log line", () => {
    expect(formatRunLogLine({ message: "hello", severity: "info" })).toBe(
      "hello",
    );
  });

  it("prints a payload it cannot read as JSON rather than dropping it", () => {
    expect(formatRunLogLine({ unexpected: true })).toBe('{"unexpected":true}');
  });
});
