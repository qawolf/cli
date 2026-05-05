import { describe, expect, it } from "bun:test";
import { createRunner } from "./createRunner.js";
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

describe("createRunner — guards and edge cases", () => {
  it("throws synchronously when retries is negative", () => {
    expect(() =>
      createRunner({
        deps: makeDeps(),
        options: { retries: -1, outputDir: "/tmp" },
      }),
    ).toThrow("retries must be a non-negative integer, got -1");
  });

  it("throws synchronously when retries is NaN", () => {
    expect(() =>
      createRunner({
        deps: makeDeps(),
        options: { retries: NaN, outputDir: "/tmp" },
      }),
    ).toThrow("retries must be a non-negative integer, got NaN");
  });

  it("reports failure (not pass) when SIGTERM fires during flow execution", async () => {
    let signalHandler: (() => void) | undefined;
    const runner = createRunner({
      deps: {
        ...makeDeps(),
        signals: {
          on: (_sig: string, handler: () => void) => {
            signalHandler = handler;
            return () => {};
          },
        },
      },
      options: { retries: 0, outputDir: "/tmp" },
    });

    const flow: FlowDefinition = {
      name: "sigterm-during-run",
      callback: async () => {
        signalHandler?.();
      },
    };

    const result = await runner.run(flow);

    expect(result.passed).toBe(false);
    expect(result.attempts).toBe(1);
  });

  it("deep-clones workflowInputs so nested mutation in one attempt does not affect the next", async () => {
    const workflowInputs = { key: { nested: "original" } };
    const runner = createRunner({
      deps: makeDeps(),
      options: { retries: 1, outputDir: "/tmp", workflowInputs },
    });

    const captured: { key: { nested: string } }[] = [];
    let attempts = 0;
    const flow: FlowDefinition = {
      name: "inputs-isolation",
      callback: async (deps) => {
        const inputs = deps.workflowInputs as { key: { nested: string } };
        captured.push(inputs);
        attempts++;
        if (attempts === 1) {
          inputs.key.nested = "mutated";
          throw new Error("retry");
        }
      },
    };

    await runner.run(flow);

    expect(captured).toHaveLength(2);
    expect(captured[0]).not.toBe(captured[1]);
    // attempt 2 should see the original value, not the mutation from attempt 1
    expect(captured[1]!.key.nested).toBe("original");
  });
});
