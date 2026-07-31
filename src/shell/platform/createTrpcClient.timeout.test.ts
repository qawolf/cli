import { afterEach, describe, expect, it, mock } from "bun:test";
import superjson from "superjson";
import { z } from "zod";

import type { Logger } from "~/shell/logger.js";

import { createTrpcClient } from "./createTrpcClient.js";
import { makeDelayedFetch, makeHangingFetch } from "./slowFetch.testUtils.js";

afterEach(() => {
  mock.restore();
});

const baseUrl = "https://test.qawolf.com";
const apiKey = "qawolf_mykey";
const path = "environment.getEnvironmentWithVariables";

function wrapped(value: unknown): { result: { data: unknown } } {
  return { result: { data: superjson.serialize(value) } };
}

describe("createTrpcClient timeouts", () => {
  it("gives up after the client's default and says it timed out", async () => {
    const client = createTrpcClient(apiKey, {
      baseUrl,
      defaultTimeoutMs: 20,
      fetch: makeHangingFetch(),
    });

    const result = await client.query(path, {}, z.unknown());

    expect(result).toEqual({
      ok: false,
      error: { kind: "timeout", timeoutMs: 20 },
    });
  });

  it("gives up after the timeout the call asked for instead of the default", async () => {
    const client = createTrpcClient(apiKey, {
      baseUrl,
      defaultTimeoutMs: 60_000,
      fetch: makeHangingFetch(),
    });

    const result = await client.mutation(path, {}, z.unknown(), {
      timeoutMs: 20,
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: "timeout", timeoutMs: 20 },
    });
  });

  // The point of the per-call timeout: a slow answer the client would otherwise
  // have abandoned is waited for, and arrives.
  it("waits for an answer that outlasts the default when the call asked for longer", async () => {
    const client = createTrpcClient(apiKey, {
      baseUrl,
      defaultTimeoutMs: 5,
      fetch: makeDelayedFetch(
        () =>
          new Response(JSON.stringify(wrapped({ ok: true })), {
            headers: { "content-type": "application/json" },
          }),
        40,
      ),
    });

    const result = await client.mutation(
      path,
      {},
      z.object({ ok: z.boolean() }),
      { timeoutMs: 5_000 },
    );

    expect(result).toEqual({ ok: true, data: { ok: true } });
  });

  it("logs the deadline it reached rather than an absent cause", async () => {
    const logger: Logger = {
      debug: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      trace: mock(() => {}),
    };
    const client = createTrpcClient(apiKey, {
      baseUrl,
      defaultTimeoutMs: 20,
      fetch: makeHangingFetch(),
      logger,
    });

    await client.query(path, {}, z.unknown());

    expect(logger.warn).toHaveBeenCalledWith(
      `← ${path} error (timeout): timed out after 20ms`,
    );
  });
});
