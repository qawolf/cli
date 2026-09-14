import { describe, expect, it } from "bun:test";

import { handleRunnerLaunch } from "./launch.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { launched } from "./launch.testUtils.js";

const url = "https://app.qawolf.com/acme/runners/ci";

async function launch(apiKeySource: string, alreadyRunning: boolean) {
  const { callPublicApi, ctx, outputs } = makeAuthCtx("human", apiKeySource);
  callPublicApi.mockResolvedValue({
    ok: true,
    value: { ...launched, id: "ci", alreadyRunning, url },
  });

  await handleRunnerLaunch(ctx, { id: "ci", name: undefined }, makeTestDeps());

  return outputs()[0];
}

describe("handleRunnerLaunch runner page url", () => {
  it("tells the caller where to watch the runner it launched", async () => {
    expect((await launch("browser", false))?.humanMessage).toBe(
      `Launched runner ci. Watch its screen at ${url}`,
    );
  });

  // Relaunching an id attaches rather than billing a second pod, so that path
  // needs the address as much as a fresh launch does.
  it("tells the caller where to watch a runner it only attached to", async () => {
    expect((await launch("browser", true))?.humanMessage).toBe(
      `Runner ci was already running. Watch its screen at ${url}`,
    );
  });

  // The runner's screen plays for anyone on its team, so how the caller signed
  // in makes no difference to what they are promised.
  it("promises the same screen to a caller holding an api key", async () => {
    expect((await launch("env", false))?.humanMessage).toBe(
      `Launched runner ci. Watch its screen at ${url}`,
    );
  });

  it("carries the url in machine-readable output", async () => {
    expect((await launch("browser", false))?.data).toMatchObject({ url });
  });
});
