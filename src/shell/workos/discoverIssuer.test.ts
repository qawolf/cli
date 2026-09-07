import { describe, expect, it, mock } from "bun:test";

import { discoverIssuer } from "./discoverIssuer.js";
import { createFetchMock, jsonResponse } from "./workos.testUtils.js";

const issuer = "https://signin.example";

const metadata = {
  issuer: "https://signin.example",
  authorization_endpoint: "https://signin.example/oauth2/authorize",
  device_authorization_endpoint:
    "https://signin.example/oauth2/device_authorization",
  token_endpoint: "https://signin.example/oauth2/token",
};

type Result = Awaited<ReturnType<typeof discoverIssuer>>;

function expectFailure(result: Result) {
  if (result.ok) throw Error("expected failure, got success");
  return result;
}

describe("discoverIssuer", () => {
  it("reads the well-known authorization server document without credentials", async () => {
    const mockFetch = createFetchMock(jsonResponse(metadata));

    await discoverIssuer(issuer, mockFetch);

    const [url, init] = (mockFetch as unknown as ReturnType<typeof mock>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://signin.example/.well-known/oauth-authorization-server",
    );
    expect(init.headers).toBeUndefined();
    // A redirect would carry later requests to a host nobody vetted.
    expect(init.redirect).toBe("manual");
  });

  it("returns the device and token endpoints the issuer advertises", async () => {
    const result = await discoverIssuer(
      issuer,
      createFetchMock(jsonResponse(metadata)),
    );

    expect(result).toEqual({
      ok: true,
      value: {
        deviceAuthorization:
          "https://signin.example/oauth2/device_authorization",
        token: "https://signin.example/oauth2/token",
      },
    });
  });

  it("tolerates a trailing slash on the configured issuer", async () => {
    const mockFetch = createFetchMock(jsonResponse(metadata));

    const result = await discoverIssuer("https://signin.example/", mockFetch);

    expect(result.ok).toBe(true);
    const [url] = (mockFetch as unknown as ReturnType<typeof mock>).mock
      .calls[0] as [string];
    expect(url).toBe(
      "https://signin.example/.well-known/oauth-authorization-server",
    );
  });

  // RFC 8414 section 3.1: for an issuer with a path, the well-known segment
  // sits between the origin and that path, not after it.
  it("asks a path-based issuer for its metadata at the RFC 8414 location", async () => {
    const tenant = "https://signin.example/tenant-a";
    const mockFetch = createFetchMock(
      jsonResponse({
        ...metadata,
        issuer: tenant,
        device_authorization_endpoint: `${tenant}/oauth2/device_authorization`,
        token_endpoint: `${tenant}/oauth2/token`,
      }),
    );

    const result = await discoverIssuer(tenant, mockFetch);

    expect(result.ok).toBe(true);
    const [url] = (mockFetch as unknown as ReturnType<typeof mock>).mock
      .calls[0] as [string];
    expect(url).toBe(
      "https://signin.example/.well-known/oauth-authorization-server/tenant-a",
    );
  });

  it("refuses an issuer that is not a URL without asking anything", async () => {
    const mockFetch = createFetchMock(jsonResponse(metadata));

    const result = await discoverIssuer("not a url", mockFetch);

    expect(expectFailure(result).retryable).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("names the metadata field when an endpoint is missing", async () => {
    const { token_endpoint: _dropped, ...partial } = metadata;

    const result = await discoverIssuer(
      issuer,
      createFetchMock(jsonResponse(partial)),
    );

    expect(expectFailure(result).error).toContain("token_endpoint");
  });

  // RFC 8414 section 3.3: a client must reject metadata whose issuer does not
  // match, or a document served for one server could speak for another.
  it("refuses metadata whose issuer is not the one configured", async () => {
    const result = await discoverIssuer(
      issuer,
      createFetchMock(jsonResponse({ ...metadata, issuer: "https://evil" })),
    );

    const failure = expectFailure(result);
    expect(failure.retryable).toBe(false);
    expect(failure.error).toContain("issuer");
  });

  it.each([
    ["device authorization", "device_authorization_endpoint"],
    ["token", "token_endpoint"],
  ])(
    "refuses metadata that advertises no %s endpoint",
    async (_label, field) => {
      const { [field]: _dropped, ...partial } = metadata as Record<
        string,
        string
      >;

      const result = await discoverIssuer(
        issuer,
        createFetchMock(jsonResponse(partial)),
      );

      expect(expectFailure(result).retryable).toBe(false);
    },
  );

  // The endpoints receive the device code and the refresh token. Following a
  // document that points them at another origin would hand those to it.
  it("refuses an endpoint on a different origin from the issuer", async () => {
    const result = await discoverIssuer(
      issuer,
      createFetchMock(
        jsonResponse({
          ...metadata,
          token_endpoint: "https://api.workos.com/user_management/authenticate",
        }),
      ),
    );

    const failure = expectFailure(result);
    expect(failure.retryable).toBe(false);
    expect(failure.error).toContain("origin");
  });

  it("refuses to follow a redirect", async () => {
    const result = await discoverIssuer(
      issuer,
      createFetchMock(
        new Response(undefined, {
          status: 302,
          headers: { location: "https://elsewhere.example/metadata" },
        }),
      ),
    );

    expect(expectFailure(result).retryable).toBe(false);
  });

  it("reports an issuer that serves no metadata as a configuration fault", async () => {
    const result = await discoverIssuer(
      issuer,
      createFetchMock(jsonResponse({ error: "not found" }, { status: 404 })),
    );

    expect(expectFailure(result).retryable).toBe(false);
  });

  it.each([
    ["a failing server", 503],
    ["rate limiting", 429],
  ])("marks %s as retryable", async (_label, status) => {
    const result = await discoverIssuer(
      issuer,
      createFetchMock(jsonResponse({ error: "boom" }, { status })),
    );

    expect(expectFailure(result).retryable).toBe(true);
  });

  it("marks an unreachable issuer as retryable", async () => {
    const mockFetch = mock<typeof fetch>().mockRejectedValue(
      Error("connect ECONNREFUSED"),
    ) as unknown as typeof fetch;

    const result = await discoverIssuer(issuer, mockFetch);

    const failure = expectFailure(result);
    expect(failure.retryable).toBe(true);
    expect(failure.error).toContain("ECONNREFUSED");
  });

  it("reports a body that is not JSON as retryable, as a captive portal would cause", async () => {
    const result = await discoverIssuer(
      issuer,
      createFetchMock(
        new Response("<html>hi</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    expect(expectFailure(result).retryable).toBe(true);
  });
});
