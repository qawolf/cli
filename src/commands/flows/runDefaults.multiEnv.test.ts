import { describe, expect, it, mock } from "bun:test";

import type { CommandContext } from "~/shell/commandContext.js";
import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import { manifestFilename } from "~/shell/manifest/io.js";
import type { OutputMode } from "~/shell/ui/env.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";
import { environmentsMessages } from "~/core/messages/index.js";

import { handleFlowsRun, type HandleFlowsRunDeps } from "./runDefaults.js";

const stagingFlow = "/proj/.qawolf/env-abc/src/flows/a.flow.ts";
const prodFlow = "/proj/.qawolf/env-xyz/src/flows/b.flow.ts";

const manifestFor = (envId: string, envSlug: string, path: string): string =>
  JSON.stringify({
    envId,
    envSlug,
    fetchedAt: "2026-09-01T12:00:00.000Z",
    tagsFetchedAt: "2026-09-01T12:00:00.000Z",
    cliFlowsVersion: "0.1.4",
    flows: [{ path, contentHash: "h1", tags: ["auth"] }],
  });

async function makeCtx(
  mode: OutputMode,
  select?: CommandContext["ui"]["select"],
): Promise<CommandContext> {
  const fs = makeMemoryFs();
  for (const [dir, envId, envSlug, path] of [
    ["/proj/.qawolf/env-abc", "env-abc", "staging", "src/flows/a.flow.ts"],
    ["/proj/.qawolf/env-xyz", "env-xyz", "prod", "src/flows/b.flow.ts"],
  ] as const) {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      `${dir}/${manifestFilename}`,
      manifestFor(envId, envSlug, path),
    );
  }
  const ui = makeFakeUI(mode);
  return {
    configDir: "/mock/config",
    apiBaseUrl: "https://app.qawolf.com",
    outputMode: mode,
    isInteractive: mode === "human",
    signals: makeNoopSignals(),
    fs,
    log: () => makeNoopLogger(),
    ui: select === undefined ? ui : { ...ui, select },
  } as unknown as CommandContext;
}

const prepareRunDirMock = mock<HandleFlowsRunDeps["prepareRunDir"]>();

function makeDeps(): HandleFlowsRunDeps {
  prepareRunDirMock.mockClear();
  prepareRunDirMock.mockImplementation(({ files }) =>
    Promise.resolve({
      files: [...files],
      runDir: "/mock/run",
      outerHop: { mode: "none" },
      cleanup: async () => {},
    }),
  );
  return {
    expandPatterns: mock(() => Promise.resolve([stagingFlow, prodFlow])),
    resolveDepsRoot: mock(() =>
      Promise.resolve({
        depsRoot: "/env",
        source: "project" as const,
        installed: false,
      }),
    ),
    prepareRunDir: prepareRunDirMock,
    configureTestkit: mock(() => Promise.resolve()),
    flowsRun: mock(() => Promise.resolve(undefined)),
    runWebFlowDeps: mock(() =>
      Promise.resolve({}),
    ) as unknown as HandleFlowsRunDeps["runWebFlowDeps"],
    createFlowRuntimeDeps: mock(() => ({
      fetchLatestEnvironmentVariables: async () => {},
    })) as unknown as HandleFlowsRunDeps["createFlowRuntimeDeps"],
  };
}

const flags: FlowsRunFlags = {
  retries: 0,
  bail: false,
  workers: 1,
  timeout: 30_000,
  video: "off",
  trace: "off",
  har: "off",
  harContent: "omit",
  outputDir: "/tmp",
  headed: false,
  browserDeps: true,
  allowNoMatch: false,
};

// A tag matching flows in two pulled environments is ambiguous: each env has
// its own variables, so the copies are different runs, not duplicates.
describe("handleFlowsRun across several pulled environments", () => {
  it("runs every match when --all-envs is set", async () => {
    const ctx = await makeCtx("json");

    const result = await handleFlowsRun(
      ctx,
      undefined,
      flags,
      makeDeps(),
      { tags: ["auth"] },
      true,
    );

    expect(result).toBeUndefined();
    expect(prepareRunDirMock).toHaveBeenCalledWith(
      expect.objectContaining({ files: [stagingFlow, prodFlow] }),
    );
  });

  it("errors with the environment labels when nobody can be asked", async () => {
    const ctx = await makeCtx("json");
    const deps = makeDeps();

    const result = await handleFlowsRun(ctx, undefined, flags, deps, {
      tags: ["auth"],
    });

    if (result === undefined) throw new Error("expected an error");
    expect(result.error).toContain("staging");
    expect(result.error).toContain("prod");
    expect(result.exitCode).toBe(2);
    expect(deps.flowsRun).not.toHaveBeenCalled();
  });

  it("aborts when the human cancels the environment prompt", async () => {
    const ctx = await makeCtx("human");
    const deps = makeDeps();

    const result = await handleFlowsRun(ctx, undefined, flags, deps, {
      tags: ["auth"],
    });

    expect(result).toBeUndefined();
    expect(ctx.ui.info).toHaveBeenCalledWith(environmentsMessages.aborted);
    expect(deps.flowsRun).not.toHaveBeenCalled();
  });

  it("runs only the chosen environment's flows", async () => {
    const select = mock(() =>
      Promise.resolve({ ok: true as const, value: "/proj/.qawolf/env-abc" }),
    ) as unknown as CommandContext["ui"]["select"];
    const ctx = await makeCtx("human", select);

    const result = await handleFlowsRun(ctx, undefined, flags, makeDeps(), {
      tags: ["auth"],
    });

    expect(result).toBeUndefined();
    expect(prepareRunDirMock).toHaveBeenCalledWith(
      expect.objectContaining({ files: [stagingFlow] }),
    );
  });
});
