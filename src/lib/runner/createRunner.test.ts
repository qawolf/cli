import { describe, expect, it } from "bun:test";
import { createRunner } from "./createRunner.js";
import { FailWithoutRetryError, FlowRunError } from "./errors.js";
import type { FlowDefinition, RunnerDeps } from "./types.js";

function makeDeps(): RunnerDeps {
  return {
    fs: {
      mkdir: async () => {},
      writeFile: async () => {},
    },
    spawn: () => ({
      exitCode: Promise.resolve(0),
      kill: () => {},
    }),
    signals: {
      on: () => () => {},
    },
    createStorage: <T>() => ({
      run: async (_store: T, callback: () => Promise<void>) => callback(),
      getStore: () => undefined,
    }),
  };
}

describe("createRunner", () => {
  it("reports pass and counts steps when flow succeeds", async () => {
    const runner = createRunner({
      deps: makeDeps(),
      options: { retries: 0, outputDir: "/tmp" },
    });
    const flow: FlowDefinition = {
      name: "example",
      callback: async (deps) => {
        await deps.test("step 1", async () => {});
        await deps.test("step 2", async () => {});
      },
    };

    const result = await runner.run(flow);

    expect(result.passed).toBe(true);
    expect(result.stepCounts).toEqual({ passed: 2, total: 2 });
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

  it("passes both inputs and workflowInputs pointing at the same value", async () => {
    const workflowInputs = { flowId: { key: "value" } };
    const runner = createRunner({
      deps: makeDeps(),
      options: { retries: 0, outputDir: "/tmp", workflowInputs },
    });
    let capturedInputs: unknown;
    let capturedWorkflowInputs: unknown;
    const flow: FlowDefinition = {
      name: "inputs-test",
      callback: async (deps) => {
        capturedInputs = deps.inputs;
        capturedWorkflowInputs = deps.workflowInputs;
      },
    };

    await runner.run(flow);

    expect(capturedInputs).toBe(workflowInputs);
    expect(capturedWorkflowInputs).toBe(workflowInputs);
  });

  it("fails the flow when a step fn throws", async () => {
    const runner = createRunner({
      deps: makeDeps(),
      options: { retries: 0, outputDir: "/tmp" },
    });
    const stepError = new Error("step failed");
    const flow: FlowDefinition = {
      name: "step-throw",
      callback: async (deps) => {
        await deps.test("bad step", async () => {
          throw stepError;
        });
      },
    };

    const result = await runner.run(flow);

    expect(result.passed).toBe(false);
    expect(result.stepCounts).toEqual({ passed: 0, total: 1 });
    expect(result.error).toBeInstanceOf(FlowRunError);
    expect((result.error as FlowRunError).cause).toBe(stepError);
  });

  it("resets step counters between retry attempts", async () => {
    const runner = createRunner({
      deps: makeDeps(),
      options: { retries: 1, outputDir: "/tmp" },
    });
    let attempts = 0;
    const flow: FlowDefinition = {
      name: "reset-test",
      callback: async (deps) => {
        attempts++;
        await deps.test("step 1", async () => {});
        if (attempts === 1) throw new Error("retry me");
      },
    };

    const result = await runner.run(flow);

    expect(result.passed).toBe(true);
    expect(result.stepCounts).toEqual({ passed: 1, total: 1 });
  });
});
