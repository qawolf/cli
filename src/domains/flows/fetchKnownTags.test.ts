import { afterEach, describe, expect, it, mock } from "bun:test";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import type { AuthCommandContext } from "~/shell/commandContext.js";
import { makeCtx as makeBaseCtx } from "~/shell/commandContext.testUtils.js";
import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";

import { fetchKnownTags } from "./fetchKnownTags.js";

afterEach(() => {
  mock.restore();
});

function makeCtx(
  callPublicApi: ReturnType<typeof makeCallPublicApiMock>,
): AuthCommandContext {
  return {
    ...makeBaseCtx("json"),
    apiKeySource: "env",
    platformClient: makeMockPlatformClient({ callPublicApi }),
  } as unknown as AuthCommandContext;
}

const page = (names: string[], nextCursor?: string) => ({
  ok: true as const,
  value: { tags: names.map((name) => ({ name })), nextCursor },
});

describe("fetchKnownTags", () => {
  it("returns every tag name on the team", async () => {
    const callPublicApi = makeCallPublicApiMock().mockResolvedValue(
      page(["auth", "smoke"]),
    );

    expect(await fetchKnownTags(makeCtx(callPublicApi))).toEqual([
      "auth",
      "smoke",
    ]);
    expect(callPublicApi).toHaveBeenCalledWith(publicContractsV1.tag.list, {
      includeFlowIds: false,
      limit: 100,
    });
  });

  it("follows the cursor until the last page", async () => {
    const callPublicApi = makeCallPublicApiMock()
      .mockResolvedValueOnce(page(["auth"], "cursor-1"))
      .mockResolvedValueOnce(page(["smoke"]));

    expect(await fetchKnownTags(makeCtx(callPublicApi))).toEqual([
      "auth",
      "smoke",
    ]);
    expect(callPublicApi).toHaveBeenLastCalledWith(publicContractsV1.tag.list, {
      includeFlowIds: false,
      limit: 100,
      cursor: "cursor-1",
    });
  });

  // Returning [] on failure would make every tag look unknown, turning an
  // outage into a wrong "no tag named X" error.
  it("returns undefined when the call fails", async () => {
    const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
      ok: false,
      error: "HTTP 500",
    });

    expect(await fetchKnownTags(makeCtx(callPublicApi))).toBeUndefined();
  });

  it("returns undefined when the call throws", async () => {
    const callPublicApi = makeCallPublicApiMock().mockRejectedValue(
      new Error("offline"),
    );

    expect(await fetchKnownTags(makeCtx(callPublicApi))).toBeUndefined();
  });

  it("stops after a bounded number of pages", async () => {
    const callPublicApi = makeCallPublicApiMock().mockResolvedValue(
      page(["auth"], "never-ending"),
    );

    const result = await fetchKnownTags(makeCtx(callPublicApi));

    expect(result).toBeDefined();
    expect(callPublicApi.mock.calls.length).toBeLessThanOrEqual(20);
  });
});
