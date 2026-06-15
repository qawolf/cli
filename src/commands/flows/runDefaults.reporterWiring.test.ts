import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { CommandContext } from "~/shell/commandContext.js";
import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import type {
  FlowsRunDeps,
  FlowsRunFlags,
} from "~/domains/runner/runInternals.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { handleFlowsRun, type HandleFlowsRunDeps } from "./runDefaults.js";

// Integration test: proves handleFlowsRun wires the reporter all the way from
// the run pipeline through ctx.ui.write to the real stdout stream. Only the
// runner pipeline is stubbed — the reporter and stream wiring are real.

const noopSignals = makeNoopSignals();

afterEach(() => {
  mock.restore();
});

function defaultFlags(): FlowsRunFlags {
  return {
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
  };
}

function makeCtx(): CommandContext {
  return {
    configDir: "/mock/config",
    apiBaseUrl: "https://app.qawolf.com",
    outputMode: "human",
    isInteractive: false,
    signals: noopSignals,
    log: () => makeNoopLogger(),
    ui: {
      ...makeFakeUI("human"),
      // Human mode routes ui.write to stdout, so the spy captures it.
      write: (text: string) => process.stdout.write(text),
    },
  } as unknown as CommandContext;
}

function makeDeps(
  flowsRun: (
    ctx: CommandContext,
    files: string[],
    flags: FlowsRunFlags,
    runDeps: FlowsRunDeps,
  ) => Promise<void>,
): HandleFlowsRunDeps {
  return {
    expandPatterns: async () => ["/fake/flow.flow.ts"],
    resolveUniqueEnvDir: () => undefined,
    ensureFlowDeps: async () => {},
    configureTestkit: async () => {},
    flowsRun: flowsRun as HandleFlowsRunDeps["flowsRun"],
    runWebFlowDeps: (async () =>
      ({}) as never) as HandleFlowsRunDeps["runWebFlowDeps"],
    createFlowRuntimeDeps: (() =>
      ({}) as never) as HandleFlowsRunDeps["createFlowRuntimeDeps"],
  };
}

/**
 * Drives handleFlowsRun, captures everything written to stdout while it runs,
 * and returns the captured string.
 */
async function runAndCapture(
  invokeReporter: (runDeps: FlowsRunDeps) => void | Promise<void>,
): Promise<{ stdout: string }> {
  const outChunks: string[] = [];
  spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    outChunks.push(typeof chunk === "string" ? chunk : String(chunk));
    return true;
  });

  await handleFlowsRun(
    makeCtx(),
    undefined,
    defaultFlags(),
    makeDeps(async (_ctx, _files, _flags, runDeps) => {
      await invokeReporter(runDeps);
    }),
  );

  return { stdout: outChunks.join("") };
}

describe("handleFlowsRun reporter wiring (integration)", () => {
  it("routes styled progress through ctx.ui.write to stdout", async () => {
    const { stdout } = await runAndCapture((runDeps) => {
      runDeps.reporter.onFlowStart?.({ name: "Login", path: "p" });
    });
    expect(stdout).toContain("Login");
    expect(stdout).toContain("p");
  });
});
