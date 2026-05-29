import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { CommandContext } from "~/shell/commandContext.js";
import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import type {
  FlowsRunDeps,
  FlowsRunFlags,
} from "~/domains/runner/runInternals.js";
import type { OutputMode } from "~/shell/ui/env.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { handleFlowsRun, type HandleFlowsRunDeps } from "./runDefaults.js";

// End-to-end integration test for WIZ-10479:
// proves that --json / --agent / human modes route the reporter all the way
// from ctx.outputMode through selectReporter to the real process streams.
// Only the runner pipeline is stubbed — the reporter, selector, and stream
// wiring are the real implementations under test.

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

function makeCtx(outputMode: OutputMode): CommandContext {
  return {
    configDir: "/mock/config",
    apiBaseUrl: "https://app.qawolf.com",
    outputMode,
    isInteractive: false,
    signals: noopSignals,
    log: () => makeNoopLogger(),
    ui: {
      ...makeFakeUI(outputMode),
      // Mirror real mode behavior: human→stdout, agent→stderr, json→no-op.
      // The stream routes reporter writes through ui.write, so the spy captures them.
      write:
        outputMode === "human"
          ? (text: string) => process.stdout.write(text)
          : outputMode === "agent"
            ? (text: string) => process.stderr.write(text)
            : () => {},
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
  };
}

/**
 * Drives handleFlowsRun for a given mode, captures everything written to
 * stdout/stderr while it runs, and returns the captured strings.
 */
async function runAndCapture(
  mode: OutputMode,
  invokeReporter: (runDeps: FlowsRunDeps) => void | Promise<void>,
): Promise<{ stdout: string; stderr: string }> {
  const outChunks: string[] = [];
  const errChunks: string[] = [];
  spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    outChunks.push(typeof chunk === "string" ? chunk : String(chunk));
    return true;
  });
  spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    errChunks.push(typeof chunk === "string" ? chunk : String(chunk));
    return true;
  });

  await handleFlowsRun(
    makeCtx(mode),
    undefined,
    defaultFlags(),
    makeDeps(async (_ctx, _files, _flags, runDeps) => {
      await invokeReporter(runDeps);
    }),
  );

  return { stdout: outChunks.join(""), stderr: errChunks.join("") };
}

describe("handleFlowsRun reporter wiring (integration)", () => {
  describe("json mode", () => {
    it("emits ND-JSON to stdout and nothing to stderr", async () => {
      const { stdout, stderr } = await runAndCapture("json", (runDeps) => {
        runDeps.reporter.onFlowStart?.({ name: "Login", path: "p" });
        runDeps.reporter.onFlowPass?.({
          name: "Login",
          path: "p",
          tests: { passed: 1, total: 1 },
          durationMs: 100,
        });
      });

      expect(stderr).toBe("");
      const events = stdout
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as { type: string });
      expect(events).toHaveLength(2);
      expect(events[0]?.type).toBe("flow.start");
      expect(events[1]?.type).toBe("flow.pass");
    });

    it("flattens err.cause chain into the flow.fail event", async () => {
      const root = new Error("root cause");
      const wrapped = new Error("outer", { cause: root });
      const { stdout } = await runAndCapture("json", (runDeps) => {
        runDeps.reporter.onFlowFail?.({
          name: "Login",
          path: "p",
          err: wrapped,
          tests: { passed: 0, total: 1 },
          durationMs: 50,
          attempt: 1,
          maxAttempts: 1,
        });
      });
      const event = JSON.parse(stdout.trim()) as {
        type: string;
        error: { message: string }[];
      };
      expect(event.type).toBe("flow.fail");
      expect(event.error).toHaveLength(2);
      expect(event.error[0]?.message).toBe("outer");
      expect(event.error[1]?.message).toBe("root cause");
    });
  });

  describe("agent mode", () => {
    it("writes ANSI-free plain text to stderr and nothing to stdout", async () => {
      const { stdout, stderr } = await runAndCapture("agent", (runDeps) => {
        runDeps.reporter.onFlowStart?.({ name: "Login", path: "p" });
        runDeps.reporter.onFlowFail?.({
          name: "Login",
          path: "p",
          err: new Error("boom"),
          tests: { passed: 0, total: 1 },
          durationMs: 50,
          attempt: 1,
          maxAttempts: 1,
        });
      });

      expect(stdout).toBe("");
      expect(stderr).toContain("START");
      expect(stderr).toContain("FAIL");
      expect(stderr).toContain("boom");
      // Match the ESC + [ + params + final letter pattern that defines ANSI
      // SGR/CSI sequences. Constructed at runtime so the source itself is
      // ANSI-free (oxlint flags inline ESC bytes in source).
      const ansiRe = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`);
      expect(ansiRe.test(stderr)).toBe(false);
    });
  });

  describe("human mode", () => {
    it("writes styled progress to stdout (status quo behavior)", async () => {
      const { stdout } = await runAndCapture("human", (runDeps) => {
        runDeps.reporter.onFlowStart?.({ name: "Login", path: "p" });
      });
      expect(stdout).toContain("Login");
      expect(stdout).toContain("p");
    });
  });
});
