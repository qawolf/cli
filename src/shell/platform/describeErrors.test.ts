import { describe, expect, it } from "bun:test";

import { describeRequestError } from "./describeErrors.js";

const baseUrl = "https://app.qawolf.com";
const reason = "Your API key has no access to this environment.";

const httpError = (status: number, body = "") =>
  ({ kind: "http", status, body }) as const;

const envelope = (message: string) =>
  JSON.stringify({ error: { json: { message } } });

describe("describeRequestError", () => {
  it.each([401, 403, 404, 500])(
    "carries the server's reason on HTTP %i",
    (status) => {
      const described = describeRequestError(
        httpError(status, envelope(reason)),
        baseUrl,
        "run.create",
      );

      expect(described.errorBody).toBe(reason);
      expect(described.error).toContain(String(status));
    },
  );

  it.each([401, 403, 404, 500])(
    "omits the body entirely when HTTP %i carries no reason",
    (status) => {
      const described = describeRequestError(
        httpError(status, "<html>gateway</html>"),
        baseUrl,
        "run.create",
      );

      expect("errorBody" in described).toBe(false);
    },
  );

  it("omits the body for a network failure", () => {
    const described = describeRequestError(
      { kind: "network", cause: new Error("connection reset") },
      baseUrl,
    );

    expect("errorBody" in described).toBe(false);
    expect(described.error).toContain(baseUrl);
  });

  it("omits the body for a timeout", () => {
    const described = describeRequestError(
      { kind: "timeout", timeoutMs: 15_000 },
      baseUrl,
    );

    expect("errorBody" in described).toBe(false);
  });

  it("omits the body for an unparseable response", () => {
    const described = describeRequestError(
      { kind: "parse", cause: new Error("bad shape") },
      baseUrl,
    );

    expect("errorBody" in described).toBe(false);
  });
});
