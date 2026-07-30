import { describe, expect, it } from "bun:test";

import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

import { defaultRunWebFlowDeps } from "./runWebFlowDeps.js";

describe("defaultRunWebFlowDeps", () => {
  it("blames the resolved deps root when Playwright cannot be loaded", async () => {
    let caught: unknown;
    try {
      await defaultRunWebFlowDeps("/nonexistent/project", makeNoopSignals());
    } catch (e) {
      caught = e;
    }

    expect((caught as Error).message).toBe(
      "Could not load Playwright from /nonexistent/project.\n" +
        "The resolved dependencies directory is incomplete. " +
        "Run `qawolf install clear`, then retry.",
    );
  });
});
