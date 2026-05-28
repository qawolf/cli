import { describe, expect, it, mock } from "bun:test";
import superjson from "superjson";

import { createPlatformClient } from "./createPlatformClient.js";

function trpcWrapped(value: unknown) {
  return { result: { data: superjson.serialize(value) } };
}

describe("PlatformClient.getFlowsBundleUrl", () => {
  it("sends environmentId in the bundle URL request", async () => {
    const fetchMock = mock<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify(
          trpcWrapped({
            expiresAt: "2099-12-31T00:00:00.000Z",
            url: "https://storage.example.com/bundle.tar.gz",
          }),
        ),
      ),
    );
    const fetch = fetchMock as unknown as typeof globalThis.fetch;

    await createPlatformClient("qawolf_key", {
      baseUrl: "https://test.qawolf.com",
      fetch,
    }).getFlowsBundleUrl("env-abc");

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.body).toBe(
      JSON.stringify(superjson.serialize({ environmentId: "env-abc" })),
    );
  });
});
