import { describe, expect, it } from "bun:test";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import { exitCodes } from "~/shell/exit.js";
import { createPlatformClient } from "~/shell/platform/createPlatformClient.js";

import { buildCommandSpecs } from "./commandSpecs.js";
import { fakeServer, trpcReply } from "./fakeServer.testUtils.js";
import { handlePublicApiCommand } from "./handle.js";
import { ctxWith } from "./handle.testUtils.js";

const baseUrl = "https://app.qawolf.com";

function run(
  routes: Parameters<typeof fakeServer>[0],
  name: "listFirings" | "runNow",
  options: Record<string, unknown>,
) {
  const spec = buildCommandSpecs({
    trigger: { [name]: publicContractsV1.trigger[name] },
  }).find((candidate) => candidate.trpcPath === `public.trigger.${name}`);
  if (!spec) throw new Error(`trigger.${name} spec missing`);
  const ui = makeFakeUI();
  const platformClient = createPlatformClient("qawolf_key", {
    baseUrl,
    fetch: fakeServer(routes).fetch,
    sleep: async () => {},
  });
  return {
    result: handlePublicApiCommand(
      { ...ctxWith(ui, platformClient), apiBaseUrl: baseUrl },
      spec,
      options,
    ),
    ui,
  };
}

describe("a trigger command the server does not serve yet", () => {
  it("says the server does not support trigger.runNow yet", async () => {
    const { result } = run({}, "runNow", {
      requestId: "request-1",
      triggerId: "trg-1",
    });

    expect(await result).toEqual({
      error:
        "QA Wolf at https://app.qawolf.com does not support trigger.runNow yet (HTTP 404). This CLI is newer than the server, so try again once the server has been updated.",
      exitCode: exitCodes.notFound,
    });
  });

  it("says the server does not support trigger.listFirings yet", async () => {
    const { result } = run({}, "listFirings", { triggerId: "trg-1" });

    expect((await result)?.error).toStartWith(
      "QA Wolf at https://app.qawolf.com does not support trigger.listFirings yet",
    );
  });

  it("still names a missing trigger on a server that serves the call", async () => {
    const { result } = run(
      {
        "trigger.runNow": () =>
          new Response(
            JSON.stringify({ error: { json: { message: "Not found" } } }),
            { headers: { "content-type": "application/json" }, status: 404 },
          ),
      },
      "runNow",
      { requestId: "request-1", triggerId: "trg-1" },
    );

    expect((await result)?.error).toBe(
      "QA Wolf has no trigger trg-1 (HTTP 404).",
    );
  });

  it("lists firings from a server that serves the call", async () => {
    const { result, ui } = run(
      {
        "trigger.listFirings": () =>
          trpcReply({
            firings: [
              {
                environmentId: "env-1",
                firedAt: "2026-11-13T09:00:00.000Z",
                id: "firing-1",
                occasion: "manual",
                outcome: "fired",
                runId: "run-1",
                startedBy: "matt@example.com",
              },
            ],
          }),
      },
      "listFirings",
      { triggerId: "trg-1" },
    );

    expect(await result).toBeUndefined();
    expect(ui.output).toHaveBeenCalledTimes(1);
  });
});
