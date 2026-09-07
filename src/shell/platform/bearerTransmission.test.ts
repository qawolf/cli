import { describe, expect, it } from "bun:test";

import { z } from "zod";

import { createTrpcClient } from "./createTrpcClient.js";
import { getIdentity } from "./getIdentity.js";

/**
 * OAuth 2.1 (draft-ietf-oauth-v2-1, section 5.1) puts one hard requirement on a
 * client sending a bearer token:
 *
 *   "clients MUST NOT send the access token in a URI query parameter"
 *   "Clients MUST use one of the two methods defined below, and MUST NOT use
 *    more than one method to transmit the token in each request."
 *
 * A token in a URL leaks into server logs, proxy logs, browser history and
 * `Referer` headers. These tests fail if any request the CLI makes to the QA
 * Wolf API ever puts the credential somewhere other than the Authorization
 * header, which is the kind of change that looks harmless in review.
 */

const token = "unmistakable-token-value";

function recordingFetch(body: unknown = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = ((url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}

function expectHeaderOnly(call: { url: string; init: RequestInit }) {
  const headers = call.init.headers as Record<string, string> | undefined;
  expect(headers?.["Authorization"]).toBe(`Bearer ${token}`);
  expect(call.url).not.toContain(token);
  const body = typeof call.init.body === "string" ? call.init.body : "";
  expect(body).not.toContain(token);
}

const baseUrl = "https://test.qawolf.com";

describe("bearer token transmission", () => {
  it("sends the identity request's token in the Authorization header only", async () => {
    const { calls, fetchFn } = recordingFetch({
      organization: { id: "o", name: "n" },
    });

    await getIdentity(token, { baseUrl, fetch: fetchFn });

    expect(calls).toHaveLength(1);
    expectHeaderOnly(calls[0]!);
  });

  it("keeps the token out of a query, even though a query carries the input", async () => {
    const { calls, fetchFn } = recordingFetch({
      result: { data: { ok: true } },
    });
    const trpc = createTrpcClient(token, { baseUrl, fetch: fetchFn });

    await trpc.query("some.route", { a: 1 }, z.unknown());

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain("input=");
    expectHeaderOnly(calls[0]!);
  });

  it("keeps the token out of a mutation body", async () => {
    const { calls, fetchFn } = recordingFetch({
      result: { data: { ok: true } },
    });
    const trpc = createTrpcClient(token, { baseUrl, fetch: fetchFn });

    await trpc.mutation("some.route", { a: 1 }, z.unknown());

    expect(calls).toHaveLength(1);
    expectHeaderOnly(calls[0]!);
  });
});
