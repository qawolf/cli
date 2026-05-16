import { describe, expect, it } from "bun:test";

import { assertHumanMode } from "./assertHumanMode.js";

describe("assertHumanMode", () => {
  it("does not throw when mode is human", () => {
    expect(() => assertHumanMode("human")).not.toThrow();
  });

  it("throws with base message when no hint is provided", () => {
    expect(() => assertHumanMode("json")).toThrow(
      "This command requires an interactive terminal.",
    );
  });

  it("throws with hint appended when provided", () => {
    expect(() =>
      assertHumanMode("agent", "Set QAWOLF_API_KEY instead."),
    ).toThrow(
      "This command requires an interactive terminal. Set QAWOLF_API_KEY instead.",
    );
  });
});
