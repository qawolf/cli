import { maxActionsPerRequest } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { makeTestDeps } from "./deps.testUtils.js";
import { aClick } from "./performActions.fixtures.js";
import { readActions } from "./readActions.js";

const piped = (input: string) => makeTestDeps({ readStdin: async () => input });

describe("readActions", () => {
  it("says nothing arrived when stdin is empty", async () => {
    const read = await readActions("-", piped("\n"));

    expect(read.ok).toBe(false);
    expect(read.ok ? "" : read.error).toContain("Nothing arrived on stdin");
  });

  it("asks for an array when the input is a single action", async () => {
    const read = await readActions(JSON.stringify(aClick), makeTestDeps());

    expect(read.ok).toBe(false);
    expect(read.ok ? "" : read.error).toContain("must be a JSON array");
  });

  it("asks for at least one action when the array is empty", async () => {
    const read = await readActions("[]", makeTestDeps());

    expect(read.ok).toBe(false);
    expect(read.ok ? "" : read.error).toContain("holds no actions");
  });

  it("says how many actions were sent and how many a request carries", async () => {
    const tooMany = JSON.stringify(Array.from({ length: 25 }, () => aClick));

    const read = await readActions(tooMany, makeTestDeps());

    expect(read.ok).toBe(false);
    const error = read.ok ? "" : read.error;
    expect(error).toContain("25 actions");
    expect(error).toContain(String(maxActionsPerRequest));
    expect(error).not.toContain("Action 10 in the sequence was refused");
  });
});
