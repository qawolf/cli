import { describe, expect, it } from "bun:test";

import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

import { defaultRunWebFlowDeps } from "./runWebFlowDeps.js";

describe("defaultRunWebFlowDeps", () => {
  it("names the env dir and the underlying cause when Playwright cannot load", async () => {
    let caught: unknown;
    try {
      await defaultRunWebFlowDeps("/nonexistent/env", makeNoopSignals());
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toStartWith(
      "Could not load Playwright from /nonexistent/env (",
    );
    expect((caught as Error).message).toEndWith(
      "Run `qawolf install` to install the runtime dependencies.",
    );
    expect((caught as Error).cause).toBeDefined();
  });
});
