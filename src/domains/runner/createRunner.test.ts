import { describe, expect, it } from "bun:test";
import { createRunner } from "./createRunner.js";
import { FailWithoutRetryError, FlowRunError } from "./errors.js";
import type { FlowDefinition, RunnerDeps } from "./types.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

function makeDeps(): RunnerDeps {
  return {
    fs: {
      mkdir: async () => {},
      writeFile: async () => {},
      unlink: async () => {},
    },
    spawn: () => ({
      exitCode: Promise.resolve(0),
      kill: () => {},
    }),
    signals: makeNoopSignals(),
    depsRoot: "/tmp",
    createStorage: <T>() => ({
      run: async (_store: T, callback: () => Promise<void>) => callback(),
      getStore: () => undefined,
    }),
  };
}

describe("createRunner", () => {
  it("reports pass and counts tests when flow succeeds", async () => {
    const runner = createRunner({
      deps: makeDeps(),
      options: { retries: 0, outputDir: "/tmp" },
    });
    const flow: FlowDefinition = {
      name: "example",
      path: "/flows/example.ts",
      callback: async (deps) => {
        await deps.test("step 1", async () => {});
        await deps.test("step 2", async () => {});
      },
    };

    const result = await runner.run(flow);

    expect(result.passed).toBe(true);
    expect(result.testCounts).toEqual({ passed: 2, total: 2 });
    expect(result.attempts).toBe(1);
    expect(result.error).toBeUndefined();
  });

  it("retries on failure — 1 retry produces 2 attempts", async () => {
    const runner = createRunner({
      deps: makeDeps(),
      options: { retries: 1, outputDir: "/tmp" },
    });
    let attempts = 0;
    const flow: FlowDefinition = {
      name: "failing",
      path: "/flows/failing.ts",
      callback: async () => {
        attempts++;
        throw new Error("oops");
      },
    };

    const result = await runner.run(flow);

    expect(attempts).toBe(2);
    expect(result.passed).toBe(false);
    expect(result.attempts).toBe(2);
  });

  it("does not retry on FailWithoutRetryError", async () => {
    const runner = createRunner({
      deps: makeDeps(),
      options: { retries: 2, outputDir: "/tmp" },
    });
    let attempts = 0;
    const flow: FlowDefinition = {
      name: "no-retry",
      path: "/flows/no-retry.ts",
      callback: async () => {
        attempts++;
        throw new FailWithoutRetryError("terminal failure");
      },
    };

    const result = await runner.run(flow);

    expect(attempts).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.attempts).toBe(1);
  });

  it("wraps failure in FlowRunError preserving the cause", async () => {
    const runner = createRunner({
      deps: makeDeps(),
      options: { retries: 0, outputDir: "/tmp" },
    });
    const original = new Error("original");
    const flow: FlowDefinition = {
      name: "err-flow",
      path: "/flows/err-flow.ts",
      callback: async () => {
        throw original;
      },
    };

    const result = await runner.run(flow);

    expect(result.error).toBeInstanceOf(FlowRunError);
    expect((result.error as FlowRunError).cause).toBe(original);
    expect((result.error as FlowRunError).flowName).toBe("err-flow");
    expect((result.error as FlowRunError).attempt).toBe(1);
  });

  it("exposes flowInputs from options to the flow callback as a clone", async () => {
    const flowInputs = { flowId: { key: "value" } };
    const runner = createRunner({
      deps: makeDeps(),
      options: { retries: 0, outputDir: "/tmp", flowInputs },
    });
    let capturedFlowInputs: unknown;
    const flow: FlowDefinition = {
      name: "inputs-test",
      path: "/flows/inputs-test.ts",
      callback: async (deps) => {
        capturedFlowInputs = deps.flowInputs;
      },
    };

    await runner.run(flow);

    expect(capturedFlowInputs).not.toBe(flowInputs);
    expect(capturedFlowInputs).toEqual(flowInputs);
  });

  it("fails the flow when a test fn throws", async () => {
    const runner = createRunner({
      deps: makeDeps(),
      options: { retries: 0, outputDir: "/tmp" },
    });
    const testError = new Error("test failed");
    const flow: FlowDefinition = {
      name: "step-throw",
      path: "/flows/step-throw.ts",
      callback: async (deps) => {
        await deps.test("bad step", async () => {
          throw testError;
        });
      },
    };

    const result = await runner.run(flow);

    expect(result.passed).toBe(false);
    expect(result.testCounts).toEqual({ passed: 0, total: 1 });
    expect(result.error).toBeInstanceOf(FlowRunError);
    expect((result.error as FlowRunError).cause).toBe(testError);
  });

  it("resets test counters between retry attempts", async () => {
    const runner = createRunner({
      deps: makeDeps(),
      options: { retries: 1, outputDir: "/tmp" },
    });
    let attempts = 0;
    const flow: FlowDefinition = {
      name: "reset-test",
      path: "/flows/reset-test.ts",
      callback: async (deps) => {
        attempts++;
        await deps.test("step 1", async () => {});
        if (attempts === 1) throw new Error("retry me");
      },
    };

    const result = await runner.run(flow);

    expect(result.passed).toBe(true);
    expect(result.testCounts).toEqual({ passed: 1, total: 1 });
  });
});
