import { describe, expect, it } from "bun:test";

import { handleRunnerLaunch } from "./launch.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { launched } from "./launch.testUtils.js";

const url = "https://app.qawolf.com/acme/runners/ci";

async function launch(alreadyRunning: boolean) {
  const { callPublicApi, ctx, outputs } = makeAuthCtx();
  callPublicApi.mockResolvedValue({
    ok: true,
    value: { ...launched, id: "ci", alreadyRunning, url },
  });

  await handleRunnerLaunch(ctx, { id: "ci", name: undefined }, makeTestDeps());

  return outputs()[0];
}

describe("handleRunnerLaunch runner page url", () => {
  it("tells the caller where to find the runner it launched", async () => {
    expect((await launch(false))?.humanMessage).toBe(
      `Launched runner ci. Its runner page is at ${url}`,
    );
  });

  // Relaunching an id attaches rather than billing a second pod, so that path
  // needs the address as much as a fresh launch does.
  it("tells the caller where to find a runner it only attached to", async () => {
    expect((await launch(true))?.humanMessage).toBe(
      `Runner ci was already running. Its runner page is at ${url}`,
    );
  });

  it("carries the url in machine-readable output", async () => {
    expect((await launch(false))?.data).toMatchObject({ url });
  });
});
