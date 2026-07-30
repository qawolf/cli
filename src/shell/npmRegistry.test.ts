import { describe, expect, it } from "bun:test";

import { fetchLatestVersion } from "./npmRegistry.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchLatestVersion", () => {
  it("returns the version from the registry's latest dist-tag", async () => {
    let requestedUrl = "";
    const version = await fetchLatestVersion("@qawolf/cli", {
      fetchFn: (url) => {
        requestedUrl = url;
        return Promise.resolve(jsonResponse({ version: "9.9.9" }));
      },
    });
    expect(version).toBe("9.9.9");
    expect(requestedUrl).toBe("https://registry.npmjs.org/@qawolf/cli/latest");
  });

  it("returns undefined on non-2xx responses", async () => {
    const version = await fetchLatestVersion("@qawolf/cli", {
      fetchFn: () => Promise.resolve(jsonResponse({ error: "not found" }, 404)),
    });
    expect(version).toBeUndefined();
  });

  it("returns undefined when the fetch rejects", async () => {
    const version = await fetchLatestVersion("@qawolf/cli", {
      fetchFn: () => Promise.reject(new Error("offline")),
    });
    expect(version).toBeUndefined();
  });

  it("returns undefined on unexpected payloads", async () => {
    // oxlint-disable-next-line unicorn/no-null -- a JSON `null` body is a real registry response shape
    for (const body of [null, "1.2.3", {}, { version: 123 }]) {
      const version = await fetchLatestVersion("@qawolf/cli", {
        fetchFn: () => Promise.resolve(jsonResponse(body)),
      });
      expect(version).toBeUndefined();
    }
  });

  it("returns undefined when the body is not JSON", async () => {
    const version = await fetchLatestVersion("@qawolf/cli", {
      fetchFn: () => Promise.resolve(new Response("<html></html>")),
    });
    expect(version).toBeUndefined();
  });
});
