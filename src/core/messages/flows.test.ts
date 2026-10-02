import { describe, expect, it } from "bun:test";

import { flowsMessages } from "./flows.js";

describe("flowsMessages.pull.summary", () => {
  it("omits the team-storage line when no assets changed", () => {
    const summary = flowsMessages.pull.summary(
      {
        envDir: "/tmp/env",
        flowCount: 1,
        envVarCount: 0,
        flowsWithTeamStorageRefs: [],
        assetDownloadedCount: 0,
        assetReusedCount: 0,
        assetSkippedCount: 0,
      },
      "/tmp/assets",
    );

    expect(summary).toBe("Pulled 1 flow into /tmp/env");
  });

  it("formats referenced flows and downloaded assets as separate lines", () => {
    const summary = flowsMessages.pull.summary(
      {
        envDir: "/tmp/env",
        flowCount: 2,
        envVarCount: 1,
        flowsWithTeamStorageRefs: ["src/flows/a.flow.ts"],
        assetDownloadedCount: 2,
        assetReusedCount: 1,
        assetSkippedCount: 1,
      },
      "/tmp/assets",
    );

    expect(summary).toBe(
      [
        "Pulled 2 flows and 1 environment variable into /tmp/env",
        "Team-storage assets referenced by 1 flow:",
        "  - src/flows/a.flow.ts",
        "Downloaded 2 team-storage assets and reused 1 team-storage asset into /tmp/assets (1 unsafe or unsupported asset skipped)",
      ].join("\n"),
    );
  });
});

describe("flowsMessages.pull.summary incomplete flows", () => {
  const base = {
    envDir: "/tmp/env",
    flowCount: 1,
    envVarCount: 0,
    flowsWithTeamStorageRefs: [],
    assetDownloadedCount: 0,
    assetReusedCount: 0,
    assetSkippedCount: 0,
  };

  it("says nothing when every key is knowable", () => {
    expect(
      flowsMessages.pull.summary({ ...base, incompleteFlowCount: 0 }, "/tmp/a"),
    ).toBe("Pulled 1 flow into /tmp/env");
  });

  // Said once as a count, not marked on each of the flows it covers.
  it("counts the flows whose list is a floor", () => {
    expect(
      flowsMessages.pull.summary({ ...base, incompleteFlowCount: 3 }, "/tmp/a"),
    ).toBe(
      [
        "Pulled 1 flow into /tmp/env",
        "3 flows may read more variables than listed; static analysis could not resolve every read.",
      ].join("\n"),
    );
  });
});

describe("flowsMessages.pull.missingEnvVars", () => {
  it("names one variable and how many flows read it", () => {
    expect(
      flowsMessages.pull.missingEnvVars([{ name: "LOGIN_PW", flowCount: 1 }]),
    ).toBe(
      [
        "1 environment variable is read by flows but not set in this environment (some reads may be optional):",
        "  - LOGIN_PW (read by 1 flow)",
      ].join("\n"),
    );
  });

  it("pluralizes across several variables and flows", () => {
    expect(
      flowsMessages.pull.missingEnvVars([
        { name: "SHARED", flowCount: 12 },
        { name: "RARE", flowCount: 1 },
      ]),
    ).toBe(
      [
        "2 environment variables are read by flows but not set in this environment (some reads may be optional):",
        "  - SHARED (read by 12 flows)",
        "  - RARE (read by 1 flow)",
      ].join("\n"),
    );
  });

  it("truncates a long list", () => {
    const missing = Array.from({ length: 9 }, (_, i) => ({
      name: `VAR_${String(i)}`,
      flowCount: 1,
    }));
    expect(flowsMessages.pull.missingEnvVars(missing)).toContain(
      "  ... and 4 more",
    );
  });
});
