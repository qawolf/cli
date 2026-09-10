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
  it("tells a signed-in person where to watch the runner it launched", async () => {
    expect((await launch("browser", false))?.humanMessage).toBe(
      `Launched runner ci. Watch its screen at ${url}`,
    );
  });

  // Relaunching an id attaches rather than billing a second pod, so that path
  // needs the address as much as a fresh launch does — but whoever launched the
  // runner first is who its screen plays for, and it need not be this caller.
  it("offers the page without the screen for a runner it only attached to", async () => {
    expect((await launch("browser", true))?.humanMessage).toBe(
      `Runner ci was already running. Its runner page is at ${url}`,
    );
  });

  // An API key may be a team key, whose runner belongs to the team's automation
  // user and plays its screen for nobody, so the page is offered without the
  // promise.
  it("only offers the page to a caller holding an api key", async () => {
    expect((await launch("env", false))?.humanMessage).toBe(
      `Launched runner ci. Its runner page is at ${url}`,
    );
  });

  it("carries the url in machine-readable output", async () => {
    expect((await launch("browser", false))?.data).toMatchObject({ url });
  });
});
