import { describe, expect, it } from "bun:test";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import { createPlatformClient } from "~/shell/platform/createPlatformClient.js";

import { buildCommandSpecs, type CommandSpec } from "./commandSpecs.js";
import { handlePublicApiCommand } from "./handle.js";
import { ctxWith } from "./handle.testUtils.js";
import { fakeServer, reportedTrigger } from "./fakeServer.testUtils.js";

const triggerSpec = (name: "create" | "update"): CommandSpec => {
  const spec = buildCommandSpecs({
    trigger: { [name]: publicContractsV1.trigger[name] },
  }).find((candidate) => candidate.trpcPath === `public.trigger.${name}`);
  if (!spec) throw new Error(`trigger.${name} spec missing`);
  return spec;
};

const scheduleOptions = {
  actionKind: "createSuite",
  actionTagNames: ["smoke"],
  cadence: "daily",
  environmentId: "env-1",
  kind: "schedule",
  name: "Nightly smoke",
  timeOfDay: "09:00",
  timezoneId: "UTC",
};

function run(
  routes: Parameters<typeof fakeServer>[0],
  options: Record<string, unknown>,
  name: "create" | "update" = "create",
) {
  const server = fakeServer(routes);
  const ui = makeFakeUI();
  const platformClient = createPlatformClient("qawolf_key", {
    baseUrl: "https://app.qawolf.com",
    fetch: server.fetch,
    sleep: async () => {},
  });
  const ctx = {
    ...ctxWith(ui, platformClient),
    apiBaseUrl: "https://app.qawolf.com",
  };
  return {
    result: handlePublicApiCommand(ctx, triggerSpec(name), options),
    server,
    ui,
  };
}

describe("a trigger written with --is-paused", () => {
  it("passes through a server that reports the trigger paused", async () => {
    const { result, server, ui } = run(
      { "trigger.create": () => reportedTrigger({ isPaused: true }) },
      { ...scheduleOptions, isPaused: true },
    );

    expect(await result).toBeUndefined();
    expect(server.calledPaths()).toEqual(["trigger.create"]);
    expect(ui.output).toHaveBeenCalledTimes(1);
  });

  it("pauses a trigger that an older server created live, and says so", async () => {
    const { result, server, ui } = run(
      {
        "trigger.create": () => reportedTrigger({ isPaused: false }),
        "trigger.pause": () => reportedTrigger({ isPaused: true }),
      },
      { ...scheduleOptions, isPaused: true },
    );

    const outcome = await result;

    expect(server.calledPaths()).toEqual(["trigger.create", "trigger.pause"]);
    expect(server.bodyOf("trigger.pause")).toEqual({ triggerId: "trg-1" });
    expect(outcome?.error).toContain("does not support --is-paused");
    expect(outcome?.error).toContain(
      "Trigger trg-1 was left running, so the CLI paused it",
    );
    expect(outcome?.errorBody).toContain(
      "qawolf trigger resume --trigger-id trg-1",
    );
    expect(ui.output).not.toHaveBeenCalled();
  });

  it("says the trigger is live when pausing it afterwards fails", async () => {
    const { result, server } = run(
      {
        "trigger.create": () => reportedTrigger({ isPaused: false }),
        "trigger.pause": () =>
          new Response(
            JSON.stringify({ error: { json: { message: "Internal error" } } }),
            { headers: { "content-type": "application/json" }, status: 500 },
          ),
      },
      { ...scheduleOptions, isPaused: true },
    );

    const outcome = await result;

    expect(server.calledPaths()).toEqual(["trigger.create", "trigger.pause"]);
    expect(outcome?.error).toStartWith("Trigger trg-1 is live and will fire.");
    expect(outcome?.errorBody).toBe(
      "Pause it now with qawolf trigger pause --trigger-id trg-1, or from its page: https://app.qawolf.com/loops/trg-1.",
    );
  });

  it("says the trigger is live when the pause call still reports it running", async () => {
    const { result } = run(
      {
        "trigger.create": () => reportedTrigger({ isPaused: false }),
        "trigger.pause": () => reportedTrigger({ isPaused: false }),
      },
      { ...scheduleOptions, isPaused: true },
    );

    expect((await result)?.error).toContain("is live and will fire");
  });

  it("pauses an update that an older server left running", async () => {
    const { result, server } = run(
      {
        "trigger.pause": () => reportedTrigger({ isPaused: true }),
        "trigger.update": () => reportedTrigger({ isPaused: false }),
      },
      { ...scheduleOptions, isPaused: true, triggerId: "trg-1" },
      "update",
    );

    expect((await result)?.error).toContain("qawolf trigger update");
    expect(server.calledPaths()).toEqual(["trigger.update", "trigger.pause"]);
  });

  it("leaves a trigger written without --is-paused alone", async () => {
    const { result, server } = run(
      { "trigger.create": () => reportedTrigger({ isPaused: false }) },
      scheduleOptions,
    );

    expect(await result).toBeUndefined();
    expect(server.calledPaths()).toEqual(["trigger.create"]);
  });
});
