import type { Reporter } from "./types.js";

// Generic picker pattern: TypeScript infers E from the Reporter field's
// callback type at each call site, giving precise parameter types without
// manual annotation.
function callEach<E>(
  reporters: Reporter[],
  pick: (r: Reporter) => ((e: E) => void) | undefined,
  event: E,
): void {
  for (const r of reporters) {
    try {
      pick(r)?.(event);
    } catch (err) {
      process.stderr.write(`[reporter error] ${String(err)}\n`);
    }
  }
}

export function createCompositeReporter(reporters: Reporter[]): Reporter {
  return {
    onFlowStart: (e) => callEach(reporters, (r) => r.onFlowStart, e),
    onFlowPass: (e) => callEach(reporters, (r) => r.onFlowPass, e),
    onFlowFail: (e) => callEach(reporters, (r) => r.onFlowFail, e),
    onTestStart: (e) => callEach(reporters, (r) => r.onTestStart, e),
    onTestResult: (e) => callEach(reporters, (r) => r.onTestResult, e),
    onScreenshot: (e) => callEach(reporters, (r) => r.onScreenshot, e),
    onRunComplete: (e) => callEach(reporters, (r) => r.onRunComplete, e),
  };
}
