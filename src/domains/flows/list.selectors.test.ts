import { sep } from "node:path";

import { afterEach, describe, expect, it, mock } from "bun:test";

import type { CommandContext } from "~/shell/commandContext.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import type { OutputMode } from "~/shell/ui/env.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { type FlowsListDeps, flowsList } from "./list.js";
import { callsOf, makeFakeUI } from "~/shell/commandContext.testUtils.js";

afterEach(() => {
  mock.restore();
});

const cwd = "/proj";
const projectFlow = "/proj/src/flows/checkout/login.flow.ts";
const pulledFlow = "/proj/.qawolf/staging/src/flows/billing/invoice.flow.ts";

function makeCtx(outputMode: OutputMode = "json"): CommandContext {
  const ui = makeFakeUI();
  return {
    ui: { ...ui, mode: outputMode },
    configDir: "/tmp/test-config",
    outputMode,
    isInteractive: false,
    apiBaseUrl: "https://example.invalid",
    signals: makeNoopSignals(),
    log: () => makeNoopLogger(),
    fs: makeMemoryFs(),
  };
}

function makeDeps(
  files: readonly string[],
  tagsByFile: Record<string, readonly string[]> = {},
): FlowsListDeps {
  return {
    cwd,
    expandPatterns: mock<FlowsListDeps["expandPatterns"]>(() =>
      Promise.resolve([...files]),
    ),
    peekFlowMeta: mock<FlowsListDeps["peekFlowMeta"]>(() =>
      Promise.resolve({ name: undefined, target: undefined }),
    ),
    readCachedTags: mock<FlowsListDeps["readCachedTags"]>(() =>
      Promise.resolve(new Map(Object.entries(tagsByFile))),
    ),
    readEnvLabel: mock<FlowsListDeps["readEnvLabel"]>((dir: string) =>
      Promise.resolve(dir),
    ),
    findPulledEnv: mock<FlowsListDeps["findPulledEnv"]>(() =>
      Promise.resolve(undefined),
    ),
    listPulledEnvDirs: mock<FlowsListDeps["listPulledEnvDirs"]>(() =>
      Promise.resolve([]),
    ),
  };
}

type Item = {
  file: string;
  group: string;
  tags?: readonly string[];
};

const itemsFrom = (ui: CommandContext["ui"]): Item[] =>
  (callsOf(ui.json)[0]?.[0] ?? []) as Item[];

// `file` is built with node:path, so it carries win32 separators on Windows.
// Compare on posix form rather than pinning one platform's spelling.
const filesFrom = (ui: CommandContext["ui"]): string[] =>
  itemsFrom(ui).map((i) => i.file.split(sep).join("/"));

describe("flowsList tags", () => {
  // Tags are platform state. A flow that was never pulled has no cached tags,
  // and reporting [] there would claim it is untagged.
  it("leaves tags undefined for a flow with no cached tags", async () => {
    const ctx = makeCtx();
    await flowsList(ctx, undefined, makeDeps([projectFlow]));

    expect(itemsFrom(ctx.ui)[0]?.tags).toBeUndefined();
  });

  it("reports tags cached in the manifest", async () => {
    const ctx = makeCtx();
    await flowsList(
      ctx,
      undefined,
      makeDeps([pulledFlow], { [pulledFlow]: ["auth", "smoke"] }),
    );

    expect(itemsFrom(ctx.ui)[0]?.tags).toEqual(["auth", "smoke"]);
  });

  it("reports an empty tag list for a pulled flow known to be untagged", async () => {
    const ctx = makeCtx();
    await flowsList(
      ctx,
      undefined,
      makeDeps([pulledFlow], { [pulledFlow]: [] }),
    );

    expect(itemsFrom(ctx.ui)[0]?.tags).toEqual([]);
  });
});

describe("flowsList --tag against cached tags", () => {
  const otherPulled = "/proj/.qawolf/staging/src/flows/checkout/login.flow.ts";

  it("keeps only flows carrying one of the named tags", async () => {
    const ctx = makeCtx();
    await flowsList(
      ctx,
      undefined,
      makeDeps([pulledFlow, otherPulled], {
        [pulledFlow]: ["billing"],
        [otherPulled]: ["auth", "smoke"],
      }),
      { tags: ["auth"] },
    );

    expect(filesFrom(ctx.ui)).toEqual([
      ".qawolf/staging/src/flows/checkout/login.flow.ts",
    ]);
  });

  it("matches any of several tags", async () => {
    const ctx = makeCtx();
    await flowsList(
      ctx,
      undefined,
      makeDeps([pulledFlow, otherPulled], {
        [pulledFlow]: ["billing"],
        [otherPulled]: ["auth"],
      }),
      { tags: ["auth", "billing"] },
    );

    expect(itemsFrom(ctx.ui)).toHaveLength(2);
  });

  // Offline there is no team tag list, so a miss cannot be called a typo.
  it("reports a plain miss without claiming the tag is unknown", async () => {
    const result = await flowsList(
      makeCtx(),
      undefined,
      makeDeps([pulledFlow], { [pulledFlow]: ["billing"] }),
      { tags: ["auth"] },
    );

    expect(result).toEqual({
      error: "No flows matched tags auth.",
      exitCode: 2,
    });
  });

  // Nothing pulled means tags are unknown, not absent — filtering would
  // silently return nothing, which reads as "no flow carries that tag".
  it("says tags are not cached when no flow has any", async () => {
    const result = await flowsList(
      makeCtx(),
      undefined,
      makeDeps([projectFlow]),
      { tags: ["auth"] },
    );

    expect(result).toMatchObject({ exitCode: 4 });
    expect(String((result as { error: string }).error)).toContain("flows pull");
  });

  // A pulled env whose flows genuinely carry no tags is a real answer.
  it("filters normally when tags are cached but empty", async () => {
    const result = await flowsList(
      makeCtx(),
      undefined,
      makeDeps([pulledFlow], { [pulledFlow]: [] }),
      { tags: ["auth"] },
    );

    expect(result).toEqual({
      error: "No flows matched tags auth.",
      exitCode: 2,
    });
  });
});
