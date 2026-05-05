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
    ).toThrow("retries must be >= 0, got -1");
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

  it("does not share workflowInputs reference across retry attempts", async () => {
    const workflowInputs = { key: { nested: "value" } };
    const runner = createRunner({
      deps: makeDeps(),
      options: { retries: 1, outputDir: "/tmp", workflowInputs },
    });

    const captured: unknown[] = [];
    let attempts = 0;
    const flow: FlowDefinition = {
      name: "inputs-isolation",
      callback: async (deps) => {
        captured.push(deps.workflowInputs);
        attempts++;
        if (attempts === 1) throw new Error("retry");
      },
    };

    await runner.run(flow);

    expect(captured).toHaveLength(2);
    expect(captured[0]).not.toBe(captured[1]);
    expect(captured[0]).toEqual({ key: { nested: "value" } });
    expect(captured[1]).toEqual({ key: { nested: "value" } });
  });
});
