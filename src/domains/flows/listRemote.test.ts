import { afterEach, describe, expect, it, mock } from "bun:test";

import type { AuthCommandContext } from "~/shell/commandContext.js";
import { makeCtx as makeBaseCtx } from "~/shell/commandContext.testUtils.js";
import type { OutputMode } from "~/shell/ui/env.js";
import type { UI } from "~/shell/ui/index.js";
import { makeMockPlatformClient } from "~/shell/platform/createPlatformClient.testUtils.js";
import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";

import { callsOf, makeFakeUI } from "~/domains/runner/run.fixtures.js";
import { flowsListRemote } from "./listRemote.js";

afterEach(() => {
  mock.restore();
});

function makeCtx(
  ui: UI,
  outputMode: OutputMode,
  platform: PlatformClient,
): AuthCommandContext {
  return {
    ...makeBaseCtx(outputMode),
    ui: { ...ui, mode: outputMode },
    apiKeySource: "env",
    platform,
  };
}

type SampleFlow = {
  executionTarget: string | Record<string, unknown>;
  id: string;
  name: string;
  path: string;
  tags: string[];
};

const sampleFlows: SampleFlow[] = [
  {
    executionTarget: "Web - Chrome",
    id: "id-1",
    name: "Login",
    path: "src/flows/login.flow.ts",
    tags: [],
  },
  {
    executionTarget: "Web - Firefox",
    id: "id-2",
    name: "Checkout",
    path: "src/flows/sub/checkout.flow.ts",
    tags: ["smoke"],
  },
];

function platformWithFlows(flows: SampleFlow[]): PlatformClient {
  return makeMockPlatformClient({
    getRemoteFlows: mock<PlatformClient["getRemoteFlows"]>().mockResolvedValue({
      ok: true,
      value: { flows },
    }),
  });
}

const stripAnsi = (s: string | undefined): string =>
  // oxlint-disable-next-line no-control-regex
  (s ?? "").replace(/\x1b\[[\d;]*m/g, "");

describe("flowsListRemote success paths", () => {
  it("renders a bolded header + name|target|file rows in human mode", async () => {
    const ui = makeFakeUI();
    const ctx = makeCtx(ui, "human", platformWithFlows(sampleFlows));

    await flowsListRemote(ctx, undefined);

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
    const ui = makeFakeUI();
    const ctx = makeCtx(ui, "agent", platformWithFlows(sampleFlows));

    await flowsListRemote(ctx, undefined);

    const output = callsOf(ui.write)
      .map((c) => String(c[0]))
      .join("");
    // oxlint-disable-next-line no-control-regex
    expect(output).not.toMatch(/\x1b/);
    expect(ui.intro).not.toHaveBeenCalled();
    expect(ui.outro).not.toHaveBeenCalled();
  });

  it("emits the items as JSON in json mode", async () => {
    const ui = makeFakeUI();
    const ctx = makeCtx(ui, "json", platformWithFlows(sampleFlows));

    await flowsListRemote(ctx, undefined);

    expect(ui.json).toHaveBeenCalledWith([
      {
        id: "id-1",
        file: "src/flows/login.flow.ts",
        name: "Login",
        tags: [],
        target: "Web - Chrome",
      },
      {
        id: "id-2",
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
    const ui = makeFakeUI();
    const ctx = makeCtx(ui, "human", platformWithFlows([]));

    const result = await flowsListRemote(ctx, undefined);

    expect(result).toBeUndefined();
    expect(ui.info).toHaveBeenCalledWith("No flows matched.");
    expect(ui.json).not.toHaveBeenCalled();
  });

  it("emits an empty JSON array in json mode", async () => {
    const ui = makeFakeUI();
    const ctx = makeCtx(ui, "json", platformWithFlows([]));
    await flowsListRemote(ctx, undefined);
    expect(ui.json).toHaveBeenCalledWith([]);
  });
});

describe("flowsListRemote pattern filtering", () => {
  it("filters flows by glob pattern against the path field", async () => {
    const ui = makeFakeUI();
    const ctx = makeCtx(ui, "json", platformWithFlows(sampleFlows));

    await flowsListRemote(ctx, "**/sub/**");

    expect(ui.json).toHaveBeenCalledWith([
      {
        id: "id-2",
        file: "src/flows/sub/checkout.flow.ts",
        name: "Checkout",
        tags: ["smoke"],
        target: "Web - Firefox",
      },
    ]);
  });

  it("falls through to the empty-list branch when pattern matches nothing", async () => {
    const ui = makeFakeUI();
    const ctx = makeCtx(ui, "human", platformWithFlows(sampleFlows));

    await flowsListRemote(ctx, "no/matches/**");

    expect(ui.info).toHaveBeenCalledWith("No flows matched.");
    expect(ui.outro).not.toHaveBeenCalled();
  });
});

describe("flowsListRemote executionTarget shapes", () => {
  it("stringifies ad-hoc target objects to JSON", async () => {
    const ui = makeFakeUI();
    const ctx = makeCtx(
      ui,
      "json",
      platformWithFlows([
        {
          executionTarget: { runner: "android", device: "Pixel 7" },
          id: "id-3",
          name: "Custom Android",
          path: "src/flows/mobile/custom-android.flow.ts",
          tags: [],
        },
      ]),
    );

    await flowsListRemote(ctx, undefined);

    expect(ui.json).toHaveBeenCalledWith([
      {
        id: "id-3",
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
    const ui = makeFakeUI();
    const ctx = makeCtx(
      ui,
      "human",
      makeMockPlatformClient({
        getRemoteFlows: mock<
          PlatformClient["getRemoteFlows"]
        >().mockResolvedValue({
          ok: false,
          error: "QA Wolf API rejected the flows request (HTTP 401).",
        }),
      }),
    );

    const result = await flowsListRemote(ctx, undefined);

    expect(result).toEqual({
      error: "QA Wolf API rejected the flows request (HTTP 401).",
    });
    expect(ui.write).not.toHaveBeenCalled();
    expect(ui.json).not.toHaveBeenCalled();
  });
});
