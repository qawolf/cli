import { describe, expect, it } from "bun:test";

import { planCarryOver } from "./carryOverPlan.js";
import { pinnedPackages } from "./pinnedPackages.js";

describe("planCarryOver", () => {
  it("carries a package the project has and the install lacks", () => {
    expect(
      planCarryOver({ present: ["date-fns-tz"], installed: ["date-fns"] }),
    ).toEqual(["date-fns-tz"]);
  });

  it("leaves a package the install already provides", () => {
    expect(
      planCarryOver({ present: ["date-fns"], installed: ["date-fns"] }),
    ).toEqual([]);
  });

  it("never carries a pinned executor package", () => {
    const pinned = pinnedPackages[0]!.name;
    expect(planCarryOver({ present: [pinned], installed: [] })).toEqual([]);
  });

  it("skips npm bookkeeping entries", () => {
    expect(
      planCarryOver({
        present: [".bin", ".package-lock.json", "date-fns-tz"],
        installed: [],
      }),
    ).toEqual(["date-fns-tz"]);
  });

  it("carries scoped packages", () => {
    expect(
      planCarryOver({ present: ["@faker-js/faker"], installed: [] }),
    ).toEqual(["@faker-js/faker"]);
  });
});
