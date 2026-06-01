import { describe, expect, it } from "bun:test";

import type { BrowserName } from "~/core/types.js";

import { runFlowsPooled } from "./runFlowsPooled.js";
import type { ResolvedFlow } from "./runInternals.js";
import {
  callsOf,
  failResult,
  makeReporter,
  passResult,
} from "./run.fixtures.js";

function makeFlows(n: number): ResolvedFlow[] {
  return Array.from({ length: n }, (_, i) => ({
    kind: "web" as const,
    file: `/proj/flow${i}.ts`,
    name: `flow${i}`,
    browser: "chromium" as BrowserName,
  }));
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("runFlowsPooled", () => {
  it("runs at most `workers` flows concurrently", async () => {
    const flows = makeFlows(5);
    let active = 0;
    let maxActive = 0;
    let dispatched = 0;
    let gateOpen = false;
    const waiters: (() => void)[] = [];
    const openGate = () => {
      gateOpen = true;
      for (const w of waiters.splice(0)) w();
    };

    const dispatch = (_flow: ResolvedFlow) =>
      new Promise<{ run: ReturnType<typeof passResult>; durationMs: number }>(
        (resolve) => {
          dispatched++;
          active++;
          maxActive = Math.max(maxActive, active);
          const finish = () => {
            active--;
            resolve({ run: passResult(), durationMs: 1 });
          };
          if (gateOpen) finish();
          else waiters.push(finish);
        },
      );

    const promise = runFlowsPooled({
      flows,
      workers: 2,
      bail: false,
      maxAttempts: 1,
      reporter: makeReporter(),
      now: () => 0,
      dispatch,
    });

    await tick();
    expect(active).toBe(2);

    openGate();
    await promise;

    expect(maxActive).toBe(2);
    expect(dispatched).toBe(5);
  });

  it("reports pass/fail and aggregates counts", async () => {
    const flows = makeFlows(2);
    const reporter = makeReporter();
    const dispatch = (flow: ResolvedFlow) =>
      Promise.resolve({
        run:
          flow.name === "flow0"
            ? passResult({ passed: 2, total: 2 })
            : passResult({ passed: 0, total: 0 }),
        durationMs: 5,
      });

    const { counts } = await runFlowsPooled({
      flows,
      workers: 2,
      bail: false,
      maxAttempts: 1,
      reporter,
      now: () => 0,
      dispatch,
    });

    expect(counts.flowsPassed).toBe(2);
    expect(counts.testsPassed).toBe(2);
    expect(counts.testsTotal).toBe(2);
    expect(callsOf(reporter.onFlowPass!)).toHaveLength(2);
  });

  it("stops launching new flows after a failure when bail is set", async () => {
    const flows = makeFlows(4);
    const reporter = makeReporter();
    const dispatch = (flow: ResolvedFlow) =>
      Promise.resolve({
        run: flow.name === "flow1" ? failResult() : passResult(),
        durationMs: 1,
      });

    const { counts } = await runFlowsPooled({
      flows,
      workers: 1,
      bail: true,
      maxAttempts: 1,
      reporter,
      now: () => 0,
      dispatch,
    });

    expect(counts.flowsPassed).toBe(1);
    expect(counts.flowsFailed).toBe(1);
    expect(counts.flowsSkipped).toBe(2);
    expect(callsOf(reporter.onFlowStart!)).toHaveLength(2);
  });
});
