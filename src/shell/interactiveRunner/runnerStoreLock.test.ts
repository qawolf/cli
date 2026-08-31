import { describe, expect, it } from "bun:test";

import { giveUpAfterMs, staleAfterMs } from "./runnerStoreLock.js";

describe("makeStoreLock timings", () => {
  it("waits long enough for an abandoned lock to become takeable", () => {
    expect(giveUpAfterMs).toBeGreaterThan(staleAfterMs);
  });
});
