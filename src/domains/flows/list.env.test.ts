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

describe("flowsList env identity", () => {
  const stagingFlow = "/proj/.qawolf/env-abc/src/flows/a.flow.ts";
  const prodFlow = "/proj/.qawolf/env-xyz/src/flows/a.flow.ts";

  function depsWithLabels(files: readonly string[]): FlowsListDeps {
    return {
      ...makeDeps(files),
      readEnvLabel: mock<FlowsListDeps["readEnvLabel"]>((dir: string) =>
        Promise.resolve(dir.endsWith("env-abc") ? "staging" : "prod"),
      ),
    };
  }

  it("labels each flow with the environment it was pulled from", async () => {
    const ctx = makeCtx();
    await flowsList(ctx, undefined, depsWithLabels([stagingFlow, prodFlow]));

    const items = itemsFrom(ctx.ui) as unknown as { env?: string }[];
    expect(items.map((i) => i.env)).toEqual(["staging", "prod"]);
  });

  it("leaves env undefined for a flow outside any pulled env", async () => {
    const ctx = makeCtx();
    await flowsList(ctx, undefined, depsWithLabels([projectFlow]));

    const items = itemsFrom(ctx.ui) as unknown as { env?: string }[];
    expect(items[0]?.env).toBeUndefined();
  });

  // One read per environment, not one per flow.
  it("reads each environment's label once", async () => {
    const deps = depsWithLabels([stagingFlow, prodFlow, stagingFlow]);
    await flowsList(makeCtx(), undefined, deps);

    expect(deps.readEnvLabel).toHaveBeenCalledTimes(2);
  });
});

describe("flowsList --env against a pulled environment", () => {
  const stagingFlow = "/proj/.qawolf/env-abc/src/flows/a.flow.ts";
  const prodFlow = "/proj/.qawolf/env-xyz/src/flows/b.flow.ts";

  function envDeps(files: readonly string[]): FlowsListDeps {
    return {
      ...makeDeps(files),
      readEnvLabel: mock<FlowsListDeps["readEnvLabel"]>((dir: string) =>
        Promise.resolve(dir.endsWith("env-abc") ? "staging" : "prod"),
      ),
      findPulledEnv: mock<FlowsListDeps["findPulledEnv"]>((ref: string) =>
        Promise.resolve(
          ref === "staging" || ref === "env-abc"
            ? { dir: "/proj/.qawolf/env-abc", envId: "env-abc" }
            : undefined,
        ),
      ),
      listPulledEnvDirs: mock<FlowsListDeps["listPulledEnvDirs"]>(() =>
        Promise.resolve(["/proj/.qawolf/env-abc", "/proj/.qawolf/env-xyz"]),
      ),
    };
  }

  it("keeps only flows from the named environment", async () => {
    const ctx = makeCtx();
    await flowsList(ctx, undefined, envDeps([stagingFlow, prodFlow]), {
      tags: [],
      env: "staging",
    });

    expect(filesFrom(ctx.ui)).toEqual([".qawolf/env-abc/src/flows/a.flow.ts"]);
  });

  it("accepts the canonical id as well as the slug", async () => {
    const ctx = makeCtx();
    await flowsList(ctx, undefined, envDeps([stagingFlow, prodFlow]), {
      tags: [],
      env: "env-abc",
    });

    expect(itemsFrom(ctx.ui)).toHaveLength(1);
  });

  // Purely local: an unknown name is answered from what is on disk, with no
  // platform call, so the error lists what was actually pulled.
  it("errors with the pulled environments when the name is unknown", async () => {
    const result = await flowsList(
      makeCtx(),
      undefined,
      envDeps([stagingFlow, prodFlow]),
      { tags: [], env: "nope" },
    );

    if (result === undefined) throw new Error("expected an error");
    expect(result.error).toContain("nope");
    expect(result.error).toContain("staging");
    expect(result.error).toContain("prod");
    expect(result.exitCode).toBe(2);
  });

  // The pattern may match no pulled flows at all; the error must still name
  // what is on disk instead of claiming nothing has been pulled.
  it("lists the pulled environments even when the pattern matched none", async () => {
    const result = await flowsList(makeCtx(), undefined, envDeps([]), {
      tags: [],
      env: "nope",
    });

    if (result === undefined) throw new Error("expected an error");
    expect(result.error).toContain("staging");
    expect(result.error).toContain("prod");
    expect(result.error).not.toContain("No environments have been pulled");
  });

  it("combines with a tag selector", async () => {
    const ctx = makeCtx();
    const deps = {
      ...envDeps([stagingFlow, prodFlow]),
      readCachedTags: mock<FlowsListDeps["readCachedTags"]>(() =>
        Promise.resolve(
          new Map<string, readonly string[]>([[stagingFlow, ["auth"]]]),
        ),
      ),
    };

    await flowsList(ctx, undefined, deps, { tags: ["auth"], env: "staging" });

    expect(itemsFrom(ctx.ui)).toHaveLength(1);
  });
});
