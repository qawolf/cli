import { afterEach, describe, expect, it, mock, type Mock } from "bun:test";
import superjson from "superjson";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { createPlatformClient } from "./createPlatformClient.js";

afterEach(() => {
  mock.restore();
});

const baseUrl = "https://test.qawolf.com";
const apiKey = "qawolf_key";
const noSleep = async (): Promise<void> => {};

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

function trpcWrapped(value: unknown) {
  return { result: { data: superjson.serialize(value) } };
}

function mockFetch(response: Response): typeof fetch {
  return mock<typeof fetch>().mockResolvedValue(
    response,
  ) as unknown as typeof fetch;
}

function calledRequest(f: typeof fetch) {
  const [url, init] = (f as unknown as Mock<typeof fetch>).mock.calls[0] ?? [];
  const h = init?.headers as Record<string, string> | undefined;
  return {
    url: url as string,
    method: init?.method ?? "",
    auth: h?.["Authorization"],
  };
}

function callCount(f: typeof fetch): number {
  return (f as unknown as Mock<typeof fetch>).mock.calls.length;
}

describe("callPublicApi", () => {
  it("sends a write contract as a mutation and returns the value", async () => {
    const runId = "run-id";
    const url = "https://app.qawolf.com/runs/run-id";
    const f = mockFetch(json(trpcWrapped({ runId, url })));

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
    }).callPublicApi(publicContractsV1.run.create, {
      environmentId: "environment-id",
      flowIds: ["flow-id"],
    });

    const req = calledRequest(f);
    expect(req.url).toBe(`${baseUrl}/api/trpc/public.run.create`);
    expect(req.method).toBe("POST");
    expect(req.auth).toBe(`Bearer ${apiKey}`);
    expect(result).toEqual({ ok: true, value: { runId, url } });
  });

  it("does not retry write contracts on network errors", async () => {
    const f = mock<typeof fetch>().mockRejectedValue(
      new Error("connection reset"),
    ) as unknown as typeof fetch;

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
      sleep: noSleep,
    }).callPublicApi(publicContractsV1.run.create, {
      environmentId: "environment-id",
      flowIds: ["flow-id"],
    });

    expect(callCount(f)).toBe(1);
    expect(result.ok).toBe(false);
  });

  it("retries read contracts on network errors", async () => {
    const readContract = {
      description: "Look up a run.",
      input: z.object({ runId: z.string() }),
      kind: "read",
      name: "run.get",
      output: z.object({ status: z.string() }),
    } as const;
    const f = mock<typeof fetch>()
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValueOnce(
        json(trpcWrapped({ status: "completed" })),
      ) as unknown as typeof fetch;

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
      sleep: noSleep,
    }).callPublicApi(readContract, { runId: "r1" });

    expect(callCount(f)).toBe(2);
    expect(result).toEqual({ ok: true, value: { status: "completed" } });
  });

  it("surfaces the server's reason alongside the status", async () => {
    const message =
      "src/flows/checkout.flow.ts is not a flow file. A run's entry point must be a flow file under src/flows.";
    const f = mockFetch(
      new Response(
        JSON.stringify({
          error: {
            json: {
              code: -32603,
              data: {
                code: "BAD_REQUEST",
                httpStatus: 400,
                path: "public.run.create",
                message,
              },
              message,
            },
          },
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
      sleep: noSleep,
    }).callPublicApi(publicContractsV1.run.create, {
      environmentId: "environment-id",
      flowIds: ["flow-id"],
    });

    expect(result).toEqual({
      ok: false,
      error: "QA Wolf API run.create request failed (HTTP 400).",
      errorBody: message,
    });
  });

  it("keeps the status-only message when the body carries no reason", async () => {
    const f = mockFetch(
      new Response("<html><body>502 Bad Gateway</body></html>", {
        status: 502,
      }),
    );

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
      sleep: noSleep,
    }).callPublicApi(publicContractsV1.run.create, {
      environmentId: "environment-id",
      flowIds: ["flow-id"],
    });

    expect(result).toEqual({
      ok: false,
      error: "QA Wolf API run.create request failed (HTTP 502).",
    });
  });
});
