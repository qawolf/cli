import { describe, expect, it } from "bun:test";

import { handleRunnerLaunch } from "./launch.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { launched } from "./launch.testUtils.js";

const watchUrl = "https://app.qawolf.com/runner/ci";

describe("handleRunnerLaunch", () => {
  // Relaunching an id attaches rather than billing a second pod, so that path
  // needs the address as much as a fresh launch does.
  it("says where to watch the runner, whether launched or attached to", async () => {
    for (const alreadyRunning of [false, true]) {
      const { callPublicApi, ctx, outputs } = makeAuthCtx();
      callPublicApi.mockResolvedValue({
        ok: true,
        value: { ...launched, id: "ci", alreadyRunning, url: watchUrl },
      });

      await handleRunnerLaunch(
        ctx,
        { id: "ci", name: undefined },
        makeTestDeps(),
      );

      expect(outputs()[0]?.humanMessage).toContain(watchUrl);
    }
  });
});
