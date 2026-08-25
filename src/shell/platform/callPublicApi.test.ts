import { afterEach, describe, expect, it, mock } from "bun:test";
import superjson from "superjson";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { createTrpcClient } from "./createTrpcClient.js";
import { callPublicApi } from "./callPublicApi.js";
import { makeHangingFetch } from "./slowFetch.testUtils.js";

afterEach(() => {
  mock.restore();
});

const baseUrl = "https://test.qawolf.com";
const apiKey = "qawolf_mykey";

function asFetch(value: unknown): typeof fetch {
  return value as typeof fetch;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
    ...init,
  });
}

function wrapped(value: unknown): { result: { data: unknown } } {
  return { result: { data: superjson.serialize(value) } };
}

describe("callPublicApi", () => {
  it("sends a write contract as a mutation to public.<name> and returns the parsed output", async () => {
    const runId = "run-id";
    const url = "https://app.qawolf.com/runs/run-id";
    const fetchSpy = mock<typeof fetch>().mockResolvedValue(
      jsonResponse(wrapped({ excludedFlows: [], runId, url })),
    );
    const trpc = createTrpcClient(apiKey, {
      baseUrl,
      fetch: asFetch(fetchSpy),
    });

    const result = await callPublicApi(trpc, publicContractsV1.run.create, {
      environmentId: "environment-id",
      flowIds: ["flow-id"],
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      `${baseUrl}/api/trpc/public.run.create`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual({
      ok: true,
      data: { excludedFlows: [], runId, url },
    });
  });

  it("sends a read contract as a query", async () => {
    const readContract = {
      description: "Look up a run.",
      input: z.object({ runId: z.string() }),
      kind: "read",
      name: "run.get",
      output: z.object({ status: z.string() }),
    } as const;
    const fetchSpy = mock<typeof fetch>().mockResolvedValue(
      jsonResponse(wrapped({ status: "completed" })),
    );
    const trpc = createTrpcClient(apiKey, {
      baseUrl,
      fetch: asFetch(fetchSpy),
    });

    const result = await callPublicApi(trpc, readContract, { runId: "r1" });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining(`${baseUrl}/api/trpc/public.run.get?input=`),
      expect.objectContaining({ method: "GET" }),
    );
    expect(result).toEqual({ ok: true, data: { status: "completed" } });
  });

  it("hands the caller's timeout to the wire call", async () => {
    const trpc = createTrpcClient(apiKey, {
      baseUrl,
      defaultTimeoutMs: 60_000,
      fetch: makeHangingFetch(),
    });

    const result = await callPublicApi(
      trpc,
      publicContractsV1.run.create,
      { environmentId: "environment-id", flowIds: ["flow-id"] },
      { timeoutMs: 20 },
    );

    expect(result).toEqual({
      ok: false,
      error: { kind: "timeout", timeoutMs: 20 },
    });
  });

  it("returns a parse error when the response does not match the output schema", async () => {
    const fetchSpy = mock<typeof fetch>().mockResolvedValue(
      jsonResponse(wrapped({ unexpected: true })),
    );
    const trpc = createTrpcClient(apiKey, {
      baseUrl,
      fetch: asFetch(fetchSpy),
    });

    const result = await callPublicApi(trpc, publicContractsV1.run.create, {
      environmentId: "environment-id",
      flowIds: ["flow-id"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("parse");
    }
  });
});
