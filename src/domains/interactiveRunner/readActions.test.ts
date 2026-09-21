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
});
