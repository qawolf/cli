import { describe, expect, it } from "bun:test";

import { resolveIdFrom } from "./resolveId.js";

const stored = async () => "stored";

describe("resolveIdFrom", () => {
  it("takes the given id over everything", async () => {
    const id = await resolveIdFrom({
      env: { X_ID: "env" },
      environmentVariable: "X_ID",
      given: "given",
      readStored: stored,
    });
    expect(id).toBe("given");
  });

  it("takes the environment over the store, ignoring a blank variable", async () => {
    const options = {
      environmentVariable: "X_ID",
      given: undefined,
      readStored: stored,
    };
    expect(await resolveIdFrom({ ...options, env: { X_ID: " env " } })).toBe(
      "env",
    );
    expect(await resolveIdFrom({ ...options, env: { X_ID: "  " } })).toBe(
      "stored",
    );
  });
});
