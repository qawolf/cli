import { describe, expect, it } from "bun:test";

import type { BrowserName } from "~/core/types.js";

import { executeWorkerFlow } from "./executeWorkerFlow.js";
import { parseWorkerResult } from "./workerProtocol.js";
import type { WorkerInput } from "./workerProtocol.js";
import type { ResolvedFlow } from "./runInternals.js";
import { makeDeps, passResult } from "./run.fixtures.js";

const flow: ResolvedFlow = {
  kind: "web",
  file: "/proj/checkout.ts",
  name: "checkout",
  browser: "chromium" as BrowserName,
};

function makeInput(): WorkerInput {
  return {
    resolvedDir: "/proj",
    flow,
    webOptions: {
      retries: 1,
      outputDir: "out",
      headed: false,
      slowMo: 0,
      video: "off",
      timeout: 30_000,
      har: "off",
      harContent: "omit",
    },
    androidOptions: { retries: 1, outputDir: "out", recordVideo: false },
  };
}

describe("executeWorkerFlow", () => {
  it("dispatches the flow and returns its serialized result", async () => {
    const dispatchArgs: { flow: ResolvedFlow }[] = [];
    const dispatch = (args: { flow: ResolvedFlow }) => {
      dispatchArgs.push({ flow: args.flow });
      return Promise.resolve({
        run: passResult({ passed: 4, total: 4 }),
        durationMs: 9,
      });
    };

    const line = await executeWorkerFlow(makeInput(), makeDeps(), dispatch);
    const parsed = parseWorkerResult(line);

    expect(dispatchArgs[0]!.flow.name).toBe("checkout");
    expect(parsed.run.passed).toBe(true);
    expect(parsed.run.testCounts).toEqual({ passed: 4, total: 4 });
    expect(parsed.durationMs).toBe(9);
  });
});
