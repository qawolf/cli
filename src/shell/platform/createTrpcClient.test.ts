import { afterEach, describe, expect, it, mock } from "bun:test";
import superjson from "superjson";
import { z } from "zod";

import { createTrpcClient } from "./createTrpcClient.js";
import type { Logger } from "~/shell/logger.js";

afterEach(() => {
  mock.restore();
});

const baseUrl = "https://test.qawolf.com";
const apiKey = "qawolf_mykey";
const path = "environment.getEnvironmentWithVariables";

function createFetchMock(response: Response) {
  return mock<typeof fetch>().mockResolvedValue(response);
}

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

describe("createTrpcClient.query", () => {
  it("sends a GET to /api/trpc/<path> with a Bearer header", async () => {
    const fetchSpy = createFetchMock(jsonResponse(wrapped({ ok: true })));
    const client = createTrpcClient(apiKey, {
      baseUrl,
      fetch: asFetch(fetchSpy),
    });

    await client.query(path, {}, z.object({ ok: z.boolean() }));

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining(`${baseUrl}/api/trpc/${path}?input=`),
      expect.objectContaining({
        headers: { Authorization: `Bearer ${apiKey}` },
        method: "GET",
      }),
    );
  });

  it("encodes input via SuperJSON in the ?input= query param", async () => {
    const fetchSpy = createFetchMock(jsonResponse(wrapped({ ok: true })));
    const client = createTrpcClient(apiKey, {
      baseUrl,
      fetch: asFetch(fetchSpy),
    });

    const input = { count: 3, when: new Date("2024-01-01T00:00:00.000Z") };
    await client.query(path, input, z.object({ ok: z.boolean() }));

    const firstArg = fetchSpy.mock.calls[0]?.[0];
    const calledUrl = typeof firstArg === "string" ? firstArg : "";
    const encoded = new URL(calledUrl).searchParams.get("input") ?? "";
    expect(superjson.parse<typeof input>(encoded)).toEqual(input);
  });

  it("returns ok with deserialized data for SuperJSON-wrapped responses", async () => {
    const value = { when: new Date("2024-06-01T12:00:00.000Z") };
    const client = createTrpcClient(apiKey, {
      baseUrl,
      fetch: asFetch(createFetchMock(jsonResponse(wrapped(value)))),
    });

    const result = await client.query(path, {}, z.object({ when: z.date() }));

    expect(result).toEqual({ ok: true, data: value });
  });

  it("passes through plain-JSON response data without deserialization", async () => {
    const client = createTrpcClient(apiKey, {
      baseUrl,
      fetch: asFetch(
        createFetchMock(jsonResponse({ result: { data: { count: 7 } } })),
      ),
    });

    const result = await client.query(
      path,
      {},
      z.object({ count: z.number() }),
    );

    expect(result).toEqual({ ok: true, data: { count: 7 } });
  });

  it("returns http error on 401", async () => {
    const client = createTrpcClient(apiKey, {
      baseUrl,
      fetch: asFetch(
        createFetchMock(new Response("unauthorized", { status: 401 })),
      ),
    });

    const result = await client.query(path, {}, z.unknown());

    expect(result).toMatchObject({
      ok: false,
      error: { body: "unauthorized", kind: "http", status: 401 },
    });
  });

  it("returns network error when fetch throws", async () => {
    const cause = new Error("connection refused");
    const fetchSpy = mock<typeof fetch>().mockRejectedValue(cause);
    const client = createTrpcClient(apiKey, {
      baseUrl,
      fetch: asFetch(fetchSpy),
    });

    const result = await client.query(path, {}, z.unknown());

    expect(result).toEqual({
      ok: false,
      error: { cause, kind: "network" },
    });
  });

  it("returns parse error when response body is not JSON", async () => {
    const client = createTrpcClient(apiKey, {
      baseUrl,
      fetch: asFetch(
        createFetchMock(
          new Response("not json", {
            headers: { "content-type": "application/json" },
            status: 200,
          }),
        ),
      ),
    });

    const result = await client.query(path, {}, z.unknown());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("parse");
  });

  it("returns parse error when superjson.deserialize throws on malformed envelope", async () => {
    const malformed = {
      result: {
        data: {
          json: { value: "string" },
          meta: { values: { value: ["not-a-real-type-tag"] } },
        },
      },
    };
    const client = createTrpcClient(apiKey, {
      baseUrl,
      fetch: asFetch(createFetchMock(jsonResponse(malformed))),
    });

    const result = await client.query(path, {}, z.unknown());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("parse");
  });

  it("returns parse error when response shape does not match schema", async () => {
    const client = createTrpcClient(apiKey, {
      baseUrl,
      fetch: asFetch(
        createFetchMock(jsonResponse(wrapped({ count: "not-a-number" }))),
      ),
    });

    const result = await client.query(
      path,
      {},
      z.object({ count: z.number() }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("parse");
  });
});

describe("createTrpcClient.mutation", () => {
  it("sends a POST with SuperJSON-serialized body and content-type header", async () => {
    const fetchSpy = createFetchMock(jsonResponse(wrapped({ ok: true })));
    const client = createTrpcClient(apiKey, {
      baseUrl,
      fetch: asFetch(fetchSpy),
    });

    const input = { name: "demo" };
    await client.mutation(path, input, z.object({ ok: z.boolean() }));

    expect(fetchSpy).toHaveBeenCalledWith(
      `${baseUrl}/api/trpc/${path}`,
      expect.objectContaining({
        body: JSON.stringify(superjson.serialize(input)),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );
  });
});

describe("createTrpcClient logger", () => {
  const makeLogger = (): Logger => ({
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    trace: mock(() => {}),
  });
  const lp = "env";

  it("emits debug → debug on success", async () => {
    const logger = makeLogger();
    const client = createTrpcClient(apiKey, {
      baseUrl,
      fetch: asFetch(createFetchMock(jsonResponse(wrapped({ ok: true })))),
      logger,
    });
    await client.query(lp, {}, z.object({ ok: z.boolean() }));
    expect(logger.debug).toHaveBeenCalledWith(`→ ${lp}`);
    expect(logger.debug).toHaveBeenCalledWith(`← ${lp} ok`);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("emits debug → warn on http failure with kind label", async () => {
    const logger = makeLogger();
    const client = createTrpcClient(apiKey, {
      baseUrl,
      fetch: asFetch(createFetchMock(new Response("nope", { status: 403 }))),
      logger,
    });
    await client.query(lp, {}, z.unknown());
    expect(logger.debug).toHaveBeenCalledWith(`→ ${lp}`);
    expect(logger.warn).toHaveBeenCalledWith(`← ${lp} error (http): 403 nope`);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
