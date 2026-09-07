import { describe, expect, it, mock } from "bun:test";

import { sendWorkosRequest } from "./send.js";

const init = {
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: "grant_type=refresh_token&refresh_token=refresh_1",
};

describe("sendWorkosRequest", () => {
  // The body carries a device code or a refresh token. A redirect that
  // forwarded it would hand it to whichever host the response named.
  it("refuses a redirect rather than following it", async () => {
    const mockFetch = mock<typeof fetch>().mockResolvedValue(
      new Response(undefined, {
        status: 302,
        headers: { location: "https://elsewhere.example/token" },
      }),
    ) as unknown as typeof fetch;

    const outcome = await sendWorkosRequest(
      "https://api.example.com/user_management/authenticate",
      init,
      mockFetch,
    );

    if (outcome.kind !== "failure") throw Error("expected a failure");
    expect(outcome.detail).toContain("redirect");
    expect(outcome.retryable).toBe(false);
    const [, options] = (mockFetch as unknown as ReturnType<typeof mock>).mock
      .calls[0] as [string, RequestInit];
    expect(options.redirect).toBe("manual");
  });
});
