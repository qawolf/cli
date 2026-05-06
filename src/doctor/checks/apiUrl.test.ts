import { afterEach, describe, expect, it, mock } from "bun:test";

import { checkApiUrl } from "./apiUrl.js";

afterEach(() => {
  mock.restore();
});

function fetchReturning(response: Response | Error): typeof globalThis.fetch {
  const fn = mock<typeof fetch>();
  if (response instanceof Error) fn.mockRejectedValue(response);
  else fn.mockResolvedValue(response);
  return fn as unknown as typeof globalThis.fetch;
}

const apiBaseUrl = "https://app.qawolf.com";

describe("checkApiUrl", () => {
  it("passes on 2xx", async () => {
    const fetch = fetchReturning(new Response(undefined, { status: 200 }));
    const r = await checkApiUrl({ fetch, apiBaseUrl });
    expect(r).toEqual({ name: "api-url", status: "pass" });
    expect(fetch).toHaveBeenCalledWith(
      apiBaseUrl,
      expect.objectContaining({ method: "HEAD" }),
    );
  });

  it("warns on non-2xx", async () => {
    const fetch = fetchReturning(new Response(undefined, { status: 500 }));
    const r = await checkApiUrl({ fetch, apiBaseUrl });
    expect(r.status).toBe("warn");
    expect(r.detail).toContain("500");
  });

  it("warns on network error", async () => {
    const fetch = fetchReturning(new Error("ECONNREFUSED"));
    const r = await checkApiUrl({ fetch, apiBaseUrl });
    expect(r.status).toBe("warn");
    expect(r.detail).toContain("ECONNREFUSED");
  });

  it("warns on timeout", async () => {
    const fetch = fetchReturning(
      Object.assign(new Error("aborted"), { name: "TimeoutError" }),
    );
    const r = await checkApiUrl({ fetch, apiBaseUrl, timeoutMs: 1 });
    expect(r.status).toBe("warn");
    expect(r.detail).toContain("aborted");
  });
});
