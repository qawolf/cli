import { afterEach, describe, expect, it, mock } from "bun:test";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import type { AuthCommandContext } from "~/shell/commandContext.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { makeDefaultFs } from "~/shell/fs.js";
import type { UI } from "~/shell/ui/index.js";
import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";

import { makeFakeUI } from "~/domains/runner/run.fixtures.js";
import { fetchBundleAndEnvVars } from "./fetchPhase.js";

afterEach(() => {
  mock.restore();
});

function makeUi(): UI {
  const ui = makeFakeUI();
  const withProgress = async (
    steps: readonly {
      task: (update: (message: string) => void) => Promise<unknown>;
    }[],
  ): Promise<unknown[]> => {
    const results: unknown[] = [];
    for (const step of steps) results.push(await step.task(() => undefined));
    return results;
  };
  return {
    ...ui,
    mode: "json",
    withProgress: withProgress as unknown as UI["withProgress"],
  };
}

function makeCtx(callPublicApi: ReturnType<typeof makeCallPublicApiMock>) {
  return {
    ui: makeUi(),
    configDir: "/tmp/test-config",
    outputMode: "json",
    isInteractive: false,
    apiBaseUrl: "https://test.qawolf.com",
    apiKeySource: "env",
    signals: makeNoopSignals(),
    log: () => makeNoopLogger(),
    fs: makeDefaultFs(),
    platformClient: makeMockPlatformClient({
      downloadBundle: mock().mockResolvedValue({
        ok: true,
        value: { tmpArchive: "/tmp/bundle.tar.gz" },
      }),
      getEnvVars: mock().mockResolvedValue({ ok: true, value: {} }),
      callPublicApi,
    }),
  } as unknown as AuthCommandContext;
}

const flowListOk = () =>
  makeCallPublicApiMock().mockResolvedValue({
    ok: true,
    value: {
      flows: [
        { flowId: "f1", path: "src/flows/a.flow.ts", tags: ["auth"] },
        { flowId: "f2", path: "src/flows/b.flow.ts", tags: [] },
      ],
    },
  });

describe("fetchBundleAndEnvVars tags", () => {
  it("fetches tags for the env including drafts", async () => {
    const callPublicApi = flowListOk();

    await fetchBundleAndEnvVars(makeCtx(callPublicApi), "env-1");

    expect(callPublicApi).toHaveBeenCalledWith(publicContractsV1.flow.list, {
      environmentId: "env-1",
      includeDrafts: true,
    });
  });

  it("returns the tags keyed by flow path", async () => {
    const result = await fetchBundleAndEnvVars(makeCtx(flowListOk()), "env-1");

    expect(result.tags?.byPath.get("src/flows/a.flow.ts")).toEqual(["auth"]);
    expect(result.tags?.byPath.get("src/flows/b.flow.ts")).toEqual([]);
    expect(result.tags?.fetchedAt).toBeInstanceOf(Date);
  });

  // Tags are an enhancement to the pull, never a precondition for it. A pull
  // that cannot reach flow.list must still deliver the bundle.
  it("still returns the bundle when the tag fetch fails", async () => {
    const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
      ok: false,
      error: "HTTP 500",
    });

    const result = await fetchBundleAndEnvVars(makeCtx(callPublicApi), "env-1");

    expect(result.tmpArchive).toBe("/tmp/bundle.tar.gz");
    expect(result.tags).toBeUndefined();
  });

  it("still returns the bundle when the tag fetch throws", async () => {
    const callPublicApi = makeCallPublicApiMock().mockRejectedValue(
      new Error("socket hang up"),
    );

    const result = await fetchBundleAndEnvVars(makeCtx(callPublicApi), "env-1");

    expect(result.tmpArchive).toBe("/tmp/bundle.tar.gz");
    expect(result.tags).toBeUndefined();
  });
});
