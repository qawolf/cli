import { describe, expect, it } from "bun:test";
import superjson from "superjson";

import type { WireError } from "./createTrpcClient.js";
import {
  describeRequestError,
  extractServerMessage,
} from "./describeErrors.js";

const baseUrl = "https://test.qawolf.com";

// The wire shape the platform returns for a tRPC error: superjson-serialized
// error shape under `error`, with the human message on both the shape and its
// data.
function errorBody(message: string, code = "BAD_REQUEST"): string {
  return JSON.stringify({
    error: superjson.serialize({
      message,
      code: -32600,
      data: { code, httpStatus: 400, message, path: "public.tag.create" },
    }),
  });
}

const http = (status: number, body = ""): WireError => ({
  kind: "http",
  status,
  body,
});

describe("extractServerMessage", () => {
  it("pulls the human message out of a tRPC/superjson error body", () => {
    const message =
      'A tag named "brian-cli-probe" already exists for this team.';
    expect(extractServerMessage(errorBody(message))).toBe(message);
  });

  it("returns undefined for a bare enum-style code", () => {
    expect(extractServerMessage(errorBody("NOT_FOUND"))).toBeUndefined();
  });

  it("returns undefined for an empty or non-JSON body", () => {
    expect(extractServerMessage("")).toBeUndefined();
    expect(extractServerMessage("not found")).toBeUndefined();
  });
});

describe("describeRequestError 404", () => {
  it("names the resource, id, and flag when a lookup hint is given", () => {
    const message = describeRequestError(http(404), baseUrl, {
      noun: "issue.get",
      notFound: {
        resource: "issue",
        idFlag: "--issue-id",
        idValue: "0000-0000",
      },
    });

    expect(message).toBe(
      'No issue found with id "0000-0000" (HTTP 404). Check the --issue-id value.',
    );
    expect(message).not.toContain("environment");
    expect(message).not.toContain("--env");
  });

  it("surfaces the server message when the missing resource is ambiguous", () => {
    const message = describeRequestError(
      http(404, errorBody("Flow flow-1 was not found.", "NOT_FOUND")),
      baseUrl,
      { noun: "flow.addTag" },
    );

    expect(message).toContain("Flow flow-1 was not found.");
    expect(message).not.toContain("--env");
  });

  it("keeps the --env hint for commands that resolve an environment", () => {
    const message = describeRequestError(http(404), baseUrl, {
      noun: "env-vars",
      environmentLookup: true,
    });

    expect(message).toContain("environment");
    expect(message).toContain("--env");
  });

  it("falls back to a neutral not-found with no context", () => {
    const message = describeRequestError(http(404), baseUrl, {
      noun: "flow.addTag",
    });

    expect(message).toBe(
      "QA Wolf API could not find the requested resource (HTTP 404).",
    );
    expect(message).not.toContain("--env");
  });
});

describe("describeRequestError other statuses", () => {
  it("surfaces the server message on a 400", () => {
    const detail =
      'A tag named "brian-cli-probe" already exists for this team.';
    const message = describeRequestError(
      http(400, errorBody(detail)),
      baseUrl,
      {
        noun: "tag.create",
      },
    );

    expect(message).toContain(detail);
    expect(message).toContain("400");
  });

  it("stays generic on a 400 with no server message", () => {
    const message = describeRequestError(http(400), baseUrl, {
      noun: "tag.create",
    });

    expect(message).toBe("QA Wolf API tag.create request failed (HTTP 400).");
  });

  it("does not surface 5xx bodies, which may carry internal detail", () => {
    const message = describeRequestError(
      http(500, errorBody("connection to db-primary refused", "INTERNAL")),
      baseUrl,
      { noun: "run.create" },
    );

    expect(message).not.toContain("db-primary");
    expect(message).toContain("500");
  });

  it("keeps auth guidance free of environment wording on 403", () => {
    const message = describeRequestError(http(403), baseUrl, {
      noun: "issue.get",
    });

    expect(message).toContain("API key");
    expect(message).not.toContain("environment");
  });
});
