import { describe, expect, it } from "vitest";

import { assertHumanMode } from "./assertHumanMode.js";

describe("assertHumanMode", () => {
  it("does not throw when mode is human", () => {
    expect(() => assertHumanMode("human", "someMethod")).not.toThrow();
  });

  it("throws with descriptive message when mode is json", () => {
    expect(() => assertHumanMode("json", "someMethod")).toThrow(
      "ctx.someMethod() requires human mode (current: json). This is a bug — the caller should check ctx.mode first.",
    );
  });

  it("throws with descriptive message when mode is agent", () => {
    expect(() => assertHumanMode("agent", "someMethod")).toThrow(
      "ctx.someMethod() requires human mode (current: agent). This is a bug — the caller should check ctx.mode first.",
    );
  });

  it("includes the method name in the error message", () => {
    expect(() => assertHumanMode("json", "prompt")).toThrow("ctx.prompt()");
  });
});
