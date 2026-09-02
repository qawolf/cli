import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import type { AuthCommandContext } from "~/shell/commandContext.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import type { UI } from "~/shell/ui/index.js";
import { makeMockPlatformClient } from "~/shell/platform/createPlatformClient.testUtils.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { makeDefaultFs } from "~/shell/fs.js";

import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import { handleFlowsPull } from "./handler.js";
import { manifestFilename } from "~/shell/manifest/io.js";
import { buildBundle } from "./pull.fixtures.js";

let workDir = "";
let destDir = "";
let bundleArchive = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-pull-handler-"));
  destDir = join(workDir, "dest");
  bundleArchive = join(workDir, "bundle.tar.gz");
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
  mock.restore();
});

// Real withProgress: runs every task in order, returns their results.
// makeFakeUI's stub resolves to []; we need the inner tasks to execute so
// the handler reaches its JSON-output branch with real result data.
function makeJsonUi(onUpdate?: (message: string) => void): UI {
  const ui = makeFakeUI();
  const withProgress = async (
    steps: readonly {
      task: (update: (message: string) => void) => Promise<unknown>;
    }[],
  ): Promise<unknown[]> => {
    const results: unknown[] = [];
    for (const step of steps) {
      results.push(await step.task((message) => onUpdate?.(message)));
    }
    return results;
  };
  return {
    ...ui,
    mode: "json",
    withProgress: withProgress as unknown as UI["withProgress"],
  };
}

const noopSignals = makeNoopSignals();

function makeCtx(
  ui: UI,
  bundlePath: string,
  envVars: Record<string, string> = {},
  syncTeamStorageAssets?: ReturnType<typeof mock>,
): AuthCommandContext {
  return {
    ui,
    configDir: "/tmp/test-config",
    outputMode: "json",
    isInteractive: false,
    apiBaseUrl: "https://test.qawolf.com",
    apiKeySource: "env",
    signals: noopSignals,
    log: () => makeNoopLogger(),
    fs: makeDefaultFs(),
    platformClient: makeMockPlatformClient({
      downloadBundle: mock().mockResolvedValue({
        ok: true,
        value: { tmpArchive: bundlePath },
      }),
      getEnvVars: mock().mockResolvedValue({
        ok: true,
        value: envVars,
      }),
      syncTeamStorageAssets:
        syncTeamStorageAssets ??
        mock().mockResolvedValue({
          ok: true,
          value: { downloadedCount: 0, reusedCount: 0, skippedCount: 0 },
        }),
    }),
  };
}

describe("handleFlowsPull json mode output", () => {
  it("emits env, envDir, assetsDir, fetchedAt, flowCount, envVarCount, flowsWithTeamStorageRefs, manifestPath", async () => {
    await buildBundle(bundleArchive, {
      flows: [
        { name: "login.flow.ts", data: "// login\n" },
        { name: "checkout.flow.ts", data: "// checkout\n" },
      ],
    });
    const ui = makeJsonUi();
    const ctx = makeCtx(ui, bundleArchive, { BASE_URL: "https://example.com" });

    await handleFlowsPull(ctx, { env: "env-abc", out: destDir });

    expect(ui.output).toHaveBeenCalledTimes(1);
    const [payload, humanMessage] = (ui.output as ReturnType<typeof mock>).mock
      .calls[0] as [Record<string, unknown>, string];
    expect(humanMessage).toBe("");
    expect(Object.keys(payload).sort()).toEqual([
      "assetDownloadedCount",
      "assetReusedCount",
      "assetSkippedCount",
      "assetsDir",
      "env",
      "envDir",
      "envVarCount",
      "fetchedAt",
      "flowCount",
      "flowsWithTeamStorageRefs",
      "manifestPath",
    ]);
    expect(payload).toEqual({
      assetsDir: expect.stringContaining(join(workDir, "assets")),
      assetDownloadedCount: 0,
      assetReusedCount: 0,
      assetSkippedCount: 0,
      env: "env-abc",
      envDir: destDir,
      fetchedAt: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      ),
      flowCount: 2,
      envVarCount: 2,
      flowsWithTeamStorageRefs: [],
      manifestPath: join(destDir, manifestFilename),
    });
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });

  it("relays per-file asset download progress to the progress step", async () => {
    await buildBundle(bundleArchive, {
      flows: [{ name: "a.flow.ts", data: "// a\n" }],
    });
    const updates: string[] = [];
    const ui = makeJsonUi((message) => updates.push(message));
    const syncMock = mock(
      async (
        _assetsAbs: string,
        opts?: {
          onProgress?: (p: { current: number; total: number }) => void;
        },
      ) => {
        opts?.onProgress?.({ current: 1, total: 3 });
        opts?.onProgress?.({ current: 2, total: 3 });
        return {
          ok: true,
          value: { downloadedCount: 3, reusedCount: 0, skippedCount: 0 },
        };
      },
    );
    const ctx = makeCtx(ui, bundleArchive, {}, syncMock);

    await handleFlowsPull(ctx, { env: "env-abc", out: destDir });

    expect(updates).toEqual([
      "Downloading team-storage assets (1/3)",
      "Downloading team-storage assets (2/3)",
    ]);
  });

  it("does not call ui.output when mode is not json", async () => {
    await buildBundle(bundleArchive, {
      flows: [{ name: "a.flow.ts", data: "// a\n" }],
    });
    const ui: UI = { ...makeJsonUi(), mode: "human" };
    const ctx: AuthCommandContext = {
      ...makeCtx(ui, bundleArchive),
      outputMode: "human",
    };

    await handleFlowsPull(ctx, { env: "env-abc", out: destDir });

    expect(ui.output).not.toHaveBeenCalled();
  });
});
