import { afterEach, describe, expect, it, mock } from "bun:test";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { createPlatformClient } from "./createPlatformClient.js";

afterEach(() => {
  mock.restore();
});

const baseUrl = "https://test.qawolf.com";

// What apex answers today, before WIZ-12139 names the missing runner: the CLI
// has to stand on its own wording against this body.
function notFound(): typeof fetch {
  return mock<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({ error: { json: { message: "Not found" } } }),
      {
        headers: { "content-type": "application/json" },
        status: 404,
      },
    ),
  ) as unknown as typeof fetch;
}

const client = () =>
  createPlatformClient("qawolf_key", {
    baseUrl,
    fetch: notFound(),
    sleep: async () => {},
  });

describe("a public API 404", () => {
  it("reads a runner route as a runner that is not running", async () => {
    const result = await client().callPublicApi(
      publicContractsV1.runner.takeScreenshot,
      { id: "agent-1" },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Runner agent-1 is not running");
    expect(result.error).not.toContain("--env");
  });

  it("reads a run lookup as a run this team does not hold", async () => {
    const result = await client().callPublicApi(publicContractsV1.run.get, {
      runId: "abc",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("no run abc on this team");
    expect(result.errorBody).toContain("qawolf runner run");
  });

  it("reads a trigger lookup as a trigger this team does not hold", async () => {
    const result = await client().callPublicApi(publicContractsV1.trigger.get, {
      triggerId: "trg-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("QA Wolf has no trigger trg-1 (HTTP 404).");
  });

  // The one case the old wording was true of, and the only one that keeps it.
  it("keeps pointing an environment-scoped route at --env", async () => {
    const result = await client().callPublicApi(publicContractsV1.run.create, {
      environmentId: "env-1",
      flowIds: ["flow-1"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Check the --env value");
  });
});
