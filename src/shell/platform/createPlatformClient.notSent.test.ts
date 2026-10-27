import { afterEach, describe, expect, it, mock } from "bun:test";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { createPlatformClient } from "./createPlatformClient.js";

afterEach(() => {
  mock.restore();
});

const noSleep = async (): Promise<void> => {};

const rejectWith = (error: Error) =>
  mock<typeof fetch>().mockRejectedValue(error) as unknown as typeof fetch;

const fetchFailed = (code: string) =>
  new TypeError("fetch failed", {
    cause: Object.assign(new Error(code), { code }),
  });

const bunRefused = Object.assign(new TypeError("Unable to connect."), {
  code: "ConnectionRefused",
});

function createRun(f: typeof fetch, baseUrl = "https://test.qawolf.com") {
  return createPlatformClient("qawolf_key", {
    baseUrl,
    fetch: f,
    sleep: noSleep,
  }).callPublicApi(publicContractsV1.run.create, {
    environmentId: "environment-id",
    flowIds: ["flow-id"],
  });
}

describe("a write that was never sent", () => {
  // Node's fetch keeps the system error as its cause; Bun's fetch is that error.
  it.each([
    ["a Node DNS failure", fetchFailed("EAI_AGAIN"), "EAI_AGAIN", true],
    ["a Bun refused connection", bunRefused, "ConnectionRefused", true],
    ["a reset", fetchFailed("UND_ERR_SOCKET"), "UND_ERR_SOCKET", false],
  ] as const)(
    "after %s, says whether the write was sent",
    async (_, error, code, notSent) => {
      const result = await createRun(rejectWith(error));

      if (result.ok) throw new Error("expected a failure");
      expect(result.error).toContain(code);
      expect(result.error.includes("Nothing was sent")).toBe(notSent);
      expect(result.mayHaveArrived).toBe(!notSent);
    },
  );

  it("is not claimed when a redirect follows the write", async () => {
    // The server gets the whole request, then redirects to a refused port.
    const server = Bun.serve({
      port: 0,
      fetch: async (req) => {
        await req.text();
        return Response.redirect("http://127.0.0.1:1/", 303);
      },
    });
    try {
      const result = await createRun(fetch, server.url.origin);

      if (result.ok) throw new Error("expected a failure");
      expect(result.error).not.toContain("Nothing was sent");
      expect(result.mayHaveArrived).toBe(true);
    } finally {
      await server.stop(true);
    }
  });

  it("is not claimed for a read", async () => {
    const result = await createPlatformClient("qawolf_key", {
      baseUrl: "https://test.qawolf.com",
      fetch: rejectWith(fetchFailed("ENOTFOUND")),
      sleep: noSleep,
    }).callPublicApi(
      {
        input: z.object({ runId: z.string() }),
        kind: "read" as const,
        name: "run.get",
        output: z.object({ status: z.string() }),
      },
      { runId: "r1" },
    );

    if (result.ok) throw new Error("expected a failure");
    expect(result.error).not.toContain("Nothing was sent");
  });
});

function sendWrite(f: typeof fetch) {
  return createPlatformClient("qawolf_key", {
    baseUrl: "https://test.qawolf.com",
    fetch: f,
    sleep: noSleep,
  }).callPublicApi(
    {
      input: z.object({ runnerId: z.string() }),
      kind: "write" as const,
      name: "runner.performAction",
      output: z.object({ outcome: z.string() }),
    },
    { runnerId: "r1" },
  );
}

describe("retrying a write", () => {
  it("sends a write again when nothing was sent", async () => {
    const f = mock<typeof fetch>()
      .mockRejectedValueOnce(fetchFailed("UND_ERR_CONNECT_TIMEOUT"))
      .mockResolvedValue(
        Response.json({ result: { data: { outcome: "success" } } }),
      );

    const result = await sendWrite(f as unknown as typeof fetch);

    expect(f).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true, value: { outcome: "success" } });
  });

  it("does not send a write again after a reset", async () => {
    const f = mock<typeof fetch>().mockRejectedValue(
      fetchFailed("UND_ERR_SOCKET"),
    );

    await sendWrite(f as unknown as typeof fetch);

    expect(f).toHaveBeenCalledTimes(1);
  });
});
