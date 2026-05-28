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
        assetSkippedCount: 1,
      },
      "/tmp/assets",
    );

    expect(summary).toBe(
      [
        "Pulled 2 flows and 1 environment variable into /tmp/env",
        "Team-storage assets referenced by 1 flow:",
        "  - src/flows/a.flow.ts",
        "Downloaded 2 team-storage assets into /tmp/assets (1 unsafe or unsupported asset skipped)",
      ].join("\n"),
    );
  });
});
