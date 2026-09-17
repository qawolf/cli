import { describe, expect, it } from "bun:test";

import { resolveIdFrom } from "./resolveId.js";

const stored = async () => "stored";

describe("resolveIdFrom", () => {
  it("takes the given id over everything", async () => {
    const resolved = await resolveIdFrom({
      env: { X_ID: "env" },
      environmentVariable: "X_ID",
      given: "given",
      readStored: stored,
    });
    expect(resolved).toEqual({ id: "given", source: "flag" });
  });

  it("takes the environment over the store, ignoring a blank variable", async () => {
    const options = {
      environmentVariable: "X_ID",
      given: undefined,
      readStored: stored,
    };
    expect(await resolveIdFrom({ ...options, env: { X_ID: " env " } })).toEqual(
      {
        id: "env",
        source: "environment",
      },
    );
    expect(await resolveIdFrom({ ...options, env: { X_ID: "  " } })).toEqual({
      id: "stored",
      source: "stored",
    });
  });

  it("resolves to nothing when no level names an id", async () => {
    expect(
      await resolveIdFrom({
        env: {},
        environmentVariable: "X_ID",
        given: undefined,
        readStored: async () => undefined,
      }),
    ).toBeUndefined();
  });
});
