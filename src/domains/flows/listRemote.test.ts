import { afterEach, describe, expect, it, mock } from "bun:test";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import type { AuthCommandContext } from "~/shell/commandContext.js";
import { makeCtx as makeBaseCtx } from "~/shell/commandContext.testUtils.js";
import type { OutputMode } from "~/shell/ui/env.js";
import type { UI } from "~/shell/ui/index.js";
import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";
import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";

import { callsOf, makeFakeUI } from "~/domains/runner/run.fixtures.js";
import { flowsListRemote, type FlowsListRemoteOptions } from "./listRemote.js";

afterEach(() => {
  mock.restore();
});

const defaultOptions: FlowsListRemoteOptions = {
  env: "environment-id",
  includeDrafts: false,
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

const stripAnsi = (s: string | undefined): string =>
  // oxlint-disable-next-line no-control-regex
  (s ?? "").replace(/\x1b\[[\d;]*m/g, "");

describe("flowsListRemote wire call", () => {
  it("calls public.flow.list with the environment and drafts flag", async () => {
    const { platformClient } = await run({
      mode: "json",
      options: { env: "env-1", includeDrafts: true },
    });

    expect(platformClient.callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.flow.list,
      { environmentId: "env-1", includeDrafts: true },
    );
  });
});

describe("flowsListRemote success paths", () => {
  it("renders a bolded header + name|target|file rows in human mode", async () => {
    const { ui } = await run({ mode: "human" });

    const output = callsOf(ui.write)
      .map((c) => String(c[0]))
      .join("");
    const lines = output.split("\n").filter((l) => l.length > 0);

    expect(lines[0]).toMatch(/\[1m/);
    expect(lines[0]).toMatch(/\[0m/);
    // oxlint-disable-next-line no-control-regex, @typescript-eslint/no-non-null-assertion
    expect(lines[0]!.replace(/\x1b[^m]*m/g, "")).toMatch(
      /^name\s+target\s+file$/,
    );
    expect(stripAnsi(lines[1])).toMatch(
      /^Login\s+Web - Chrome\s+src\/flows\/login\.flow\.ts$/,
    );
    expect(stripAnsi(lines[2])).toMatch(
      /^Checkout\s+Web - Firefox\s+src\/flows\/sub\/checkout\.flow\.ts$/,
    );
    expect(ui.intro).toHaveBeenCalledWith("Remote Flows");
    expect(ui.outro).toHaveBeenCalledWith("2 flows");
    expect(ui.json).not.toHaveBeenCalled();
  });

  it("emits an unbolded table in agent mode", async () => {
    const { ui } = await run({ mode: "agent" });

    const output = callsOf(ui.write)
      .map((c) => String(c[0]))
      .join("");
    // oxlint-disable-next-line no-control-regex
    expect(output).not.toMatch(/\x1b/);
    expect(ui.intro).not.toHaveBeenCalled();
    expect(ui.outro).not.toHaveBeenCalled();
  });

  it("emits the items as JSON in json mode", async () => {
    const { ui } = await run({ mode: "json" });

    expect(ui.json).toHaveBeenCalledWith([
      {
        flowId: "flow-id-1",
        file: "src/flows/login.flow.ts",
        name: "Login",
        tags: [],
        target: "Web - Chrome",
      },
      {
        flowId: "flow-id-2",
        file: "src/flows/sub/checkout.flow.ts",
        name: "Checkout",
        tags: ["smoke"],
        target: "Web - Firefox",
      },
    ]);
    expect(ui.write).not.toHaveBeenCalled();
  });
});

describe("flowsListRemote empty list", () => {
  it("prints 'No flows matched.' via info in human mode", async () => {
    const { ui, result } = await run({ mode: "human", flows: [] });

    expect(result).toBeUndefined();
    expect(ui.info).toHaveBeenCalledWith("No flows matched.");
    expect(ui.json).not.toHaveBeenCalled();
  });

  it("emits an empty JSON array in json mode", async () => {
    const { ui } = await run({ mode: "json", flows: [] });
    expect(ui.json).toHaveBeenCalledWith([]);
  });
});

describe("flowsListRemote pattern filtering", () => {
  it("filters flows by glob pattern against the path field", async () => {
    const { ui } = await run({ mode: "json", pattern: "**/sub/**" });

    expect(ui.json).toHaveBeenCalledWith([
      {
        flowId: "flow-id-2",
        file: "src/flows/sub/checkout.flow.ts",
        name: "Checkout",
        tags: ["smoke"],
        target: "Web - Firefox",
      },
    ]);
  });

  it("falls through to the empty-list branch when pattern matches nothing", async () => {
    const { ui } = await run({ mode: "human", pattern: "no/matches/**" });

    expect(ui.info).toHaveBeenCalledWith("No flows matched.");
    expect(ui.outro).not.toHaveBeenCalled();
  });
});

describe("flowsListRemote executionTarget shapes", () => {
  it("stringifies ad-hoc target objects to JSON", async () => {
    const { ui } = await run({
      mode: "json",
      flows: [
        {
          executionTarget: { runner: "android", device: "Pixel 7" },
          flowId: "flow-id-3",
          name: "Custom Android",
          path: "src/flows/mobile/custom-android.flow.ts",
          tags: [],
        },
      ],
    });

    expect(ui.json).toHaveBeenCalledWith([
      {
        flowId: "flow-id-3",
        file: "src/flows/mobile/custom-android.flow.ts",
        name: "Custom Android",
        tags: [],
        target: '{"runner":"android","device":"Pixel 7"}',
      },
    ]);
  });
});

describe("flowsListRemote platform error", () => {
  it("returns a CommandResult with the platform error message", async () => {
    const { ui, result } = await run({
      mode: "human",
      platformClient: makeMockPlatformClient({
        callPublicApi: makeCallPublicApiMock().mockResolvedValue({
          ok: false,
          error: "QA Wolf API rejected the flow.list request (HTTP 401).",
        }),
      }),
    });

    expect(result).toEqual({
      error: "QA Wolf API rejected the flow.list request (HTTP 401).",
    });
    expect(ui.write).not.toHaveBeenCalled();
    expect(ui.json).not.toHaveBeenCalled();
  });
});
