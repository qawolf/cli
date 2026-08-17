import { describe, expect, it } from "bun:test";

import { runnerMessages } from "./runner.js";

describe("outerHopCarriedOver", () => {
  it("lists every carried package when there are few", () => {
    expect(runnerMessages.outerHopCarriedOver(["date-fns-tz", "lodash"])).toBe(
      'Carried over 2 undeclared packages from the project node_modules: date-fns-tz, lodash. Declare them in package.json "dependencies".',
    );
  });

  it("counts the remainder past the fifth package", () => {
    const names = ["a", "b", "c", "d", "e", "f", "g"];
    expect(runnerMessages.outerHopCarriedOver(names)).toContain(
      "a, b, c, d, e and 2 more",
    );
  });
});
