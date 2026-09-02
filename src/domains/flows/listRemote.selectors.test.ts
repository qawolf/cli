import { afterEach, describe, expect, it, mock } from "bun:test";

import type { AuthCommandContext } from "~/shell/commandContext.js";
import { makeCtx as makeBaseCtx } from "~/shell/commandContext.testUtils.js";
import type { OutputMode } from "~/shell/ui/env.js";
import type { UI } from "~/shell/ui/index.js";
import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";
import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";

import { callsOf, makeFakeUI } from "~/shell/commandContext.testUtils.js";
import { flowsListRemote, type FlowsListRemoteOptions } from "./listRemote.js";

afterEach(() => {
  mock.restore();
});

const defaultOptions: FlowsListRemoteOptions = {
  env: "environment-id",
  includeDrafts: false,
  tags: [],
};

type SampleFlow = {
  executionTarget: string | Record<string, unknown>;
  flowId: string;
  name: string;
  path: string;
  tags: string[];
};

const sampleFlows: SampleFlow[] = [
  {
    executionTarget: "Web - Chrome",
    flowId: "flow-id-1",
    name: "Login",
    path: "src/flows/login.flow.ts",
    tags: [],
  },
  {
    executionTarget: "Web - Firefox",
    flowId: "flow-id-2",
    name: "Checkout",
    path: "src/flows/sub/checkout.flow.ts",
    tags: ["smoke"],
  },
];

function platformWithFlows(flows: SampleFlow[]): PlatformClient {
  return makeMockPlatformClient({
    callPublicApi: makeCallPublicApiMock().mockResolvedValue({
      ok: true,
      value: { flows },
    }),
  });
}

// flow.list and tag.list go through the same client method, so responses are
// keyed on which contract was asked for.
function platformWithTags(
  flows: SampleFlow[],
  teamTags: string[] | "unreachable",
): PlatformClient {
  return makeMockPlatformClient({
    callPublicApi: makeCallPublicApiMock().mockImplementation(
      (contract: { name: string }) => {
        if (contract.name === "tag.list") {
          return Promise.resolve(
            teamTags === "unreachable"
              ? { ok: false, error: "HTTP 503" }
              : {
                  ok: true,
                  value: { tags: teamTags.map((name) => ({ name })) },
                },
          );
        }
        return Promise.resolve({ ok: true, value: { flows } });
      },
    ),
  });
}

async function run(opts: {
  mode: OutputMode;
  flows?: SampleFlow[];
  pattern?: string;
  options?: FlowsListRemoteOptions;
  platformClient?: PlatformClient;
}): Promise<{ ui: UI; platformClient: PlatformClient; result: unknown }> {
  const ui = makeFakeUI();
  const platformClient =
    opts.platformClient ?? platformWithFlows(opts.flows ?? sampleFlows);
  const ctx: AuthCommandContext = {
    ...makeBaseCtx(opts.mode),
    ui: { ...ui, mode: opts.mode },
    apiKeySource: "env",
    platformClient,
  };
  const result = await flowsListRemote(
    ctx,
    opts.pattern,
    opts.options ?? defaultOptions,
  );
  return { ui, platformClient, result };
}

describe("flowsListRemote tag selector", () => {
  it("keeps only flows carrying one of the named tags", async () => {
    const { ui } = await run({
      mode: "json",
      options: { ...defaultOptions, tags: ["smoke", "nope"] },
    });

    const items = callsOf(ui.json)[0]?.[0] as { file: string }[];
    expect(items.map((i) => i.file)).toEqual([
      "src/flows/sub/checkout.flow.ts",
    ]);
  });

  it("lists every flow when no tag is given", async () => {
    const { ui } = await run({ mode: "json" });

    const items = callsOf(ui.json)[0]?.[0] as { file: string }[];
    expect(items).toHaveLength(2);
  });

  it("still exits 0 with no selector and no flows", async () => {
    const { result } = await run({ mode: "json", flows: [] });
    expect(result).toBeUndefined();
  });
});

describe("flowsListRemote unknown tag names", () => {
  // Regression: a tag one character off a real tag reported only a generic
  // miss, because the listing never consulted the team's tag list.
  it("suggests a near miss from the team tag list", async () => {
    const { result } = await run({
      mode: "json",
      platformClient: platformWithTags(sampleFlows, ["smoke", "auth"]),
      options: { ...defaultOptions, tags: ["smok"] },
    });

    expect(result).toMatchObject({
      error: "No tag named 'smok' on this team. Did you mean 'smoke'?",
      exitCode: 2,
    });
  });

  it("reports a real tag that matched no flows here", async () => {
    const { result } = await run({
      mode: "json",
      platformClient: platformWithTags(sampleFlows, ["smoke", "auth"]),
      options: { ...defaultOptions, tags: ["auth"] },
    });

    expect(result).toMatchObject({
      error: "No flows matched tags auth.",
      exitCode: 2,
    });
  });

  // Without the team list we cannot prove a name is wrong, so we must not say
  // it is: a tag can exist on the team while no flow in this env carries it.
  it("does not claim a tag is unknown when the tag list is unreachable", async () => {
    const { result } = await run({
      mode: "json",
      platformClient: platformWithTags(sampleFlows, "unreachable"),
      options: { ...defaultOptions, tags: ["smok"] },
    });

    expect(result).toMatchObject({
      error: "No flows matched tags smok.",
      exitCode: 2,
    });
  });
});
