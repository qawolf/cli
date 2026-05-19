import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import type { CommandContext } from "~/shell/commandContext.js";
import type { UI } from "~/shell/ui/index.js";

import { makeFakeUI } from "~/domains/runner/run.fixtures.js";
import { handleFlowsPull } from "./handler.js";
import { manifestFilename } from "~/shell/manifest/io.js";
import {
  buildBundle,
  makeFakeFetch,
  testApiKey,
  testBaseUrl,
} from "./pull.fixtures.js";

let workDir = "";
let destDir = "";
let bundleArchive = "";
const originalFetch = globalThis.fetch;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-pull-handler-"));
  destDir = join(workDir, "dest");
  bundleArchive = join(workDir, "bundle.tar.gz");
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
  globalThis.fetch = originalFetch;
  mock.restore();
});

// Real withProgress: runs every task in order, returns their results.
// makeFakeUI's stub resolves to []; we need the inner tasks to execute so
// the handler reaches its JSON-output branch with real result data.
function makeJsonUi(): UI {
  const ui = makeFakeUI();
  const withProgress = async (
    steps: readonly { task: () => Promise<unknown> }[],
  ): Promise<unknown[]> => {
    const results: unknown[] = [];
    for (const step of steps) {
      results.push(await step.task());
    }
    return results;
  };
  return {
    ...ui,
    mode: "json",
    withProgress: withProgress as unknown as UI["withProgress"],
  };
}

function makeCtx(ui: UI): CommandContext {
  return {
    ui,
    configDir: "/tmp/test-config",
    outputMode: "json",
    isInteractive: false,
    apiBaseUrl: testBaseUrl,
  };
}

describe("handleFlowsPull json mode output", () => {
  it("emits env, envDir, fetchedAt, flowCount, envVarCount, manifestPath", async () => {
    await buildBundle(bundleArchive, {
      flows: [
        { name: "login.flow.ts", data: "// login\n" },
        { name: "checkout.flow.ts", data: "// checkout\n" },
      ],
    });
    const fakeFetch = makeFakeFetch({
      kind: "ok",
      sourceArchive: bundleArchive,
      envVars: { BASE_URL: "https://example.com" },
    });
    globalThis.fetch = fakeFetch.fetch;
    const ui = makeJsonUi();
    const ctx = makeCtx(ui);

    await handleFlowsPull(ctx, {
      env: "env-abc",
      out: destDir,
      apiKey: testApiKey,
    });

    expect(ui.output).toHaveBeenCalledTimes(1);
    const [payload, humanMessage] = (ui.output as ReturnType<typeof mock>).mock
      .calls[0] as [Record<string, unknown>, string];
    expect(humanMessage).toBe("");
    expect(Object.keys(payload).sort()).toEqual([
      "env",
      "envDir",
      "envVarCount",
      "fetchedAt",
      "flowCount",
      "manifestPath",
    ]);
    expect(payload).toEqual({
      env: "env-abc",
      envDir: destDir,
      fetchedAt: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      ),
      flowCount: 2,
      envVarCount: 2,
      manifestPath: join(destDir, manifestFilename),
    });
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });

  it("does not call ui.output when mode is not json", async () => {
    await buildBundle(bundleArchive, {
      flows: [{ name: "a.flow.ts", data: "// a\n" }],
    });
    const fakeFetch = makeFakeFetch({
      kind: "ok",
      sourceArchive: bundleArchive,
    });
    globalThis.fetch = fakeFetch.fetch;
    const ui: UI = { ...makeJsonUi(), mode: "human" };
    const ctx: CommandContext = { ...makeCtx(ui), outputMode: "human" };

    await handleFlowsPull(ctx, {
      env: "env-abc",
      out: destDir,
      apiKey: testApiKey,
    });

    expect(ui.output).not.toHaveBeenCalled();
  });
});
