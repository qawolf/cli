import { join } from "node:path";
import { describe, expect, it } from "bun:test";

import {
  createJUnitReporter,
  resolveJUnitOutputPath,
} from "./createJUnitReporter.js";
import { makeSummary } from "./reporter.testUtils.js";

function makeDeps() {
  const writes: { path: string; content: string }[] = [];
  const errs: string[] = [];
  return {
    writes,
    errs,
    deps: {
      outputPath: "/out/junit-report.xml",
      writeFile: (path: string, content: string) => {
        writes.push({ path, content });
      },
      stderr: { write: (s: string) => errs.push(s) },
    },
  };
}

describe("resolveJUnitOutputPath", () => {
  it("defaults to junit-report.xml inside the output dir when the flag is bare", () => {
    expect(resolveJUnitOutputPath(true, "qawolf-output")).toBe(
      join("qawolf-output", "junit-report.xml"),
    );
  });

  it("uses an explicit path verbatim when the flag carries one", () => {
    expect(resolveJUnitOutputPath("reports/ci.xml", "qawolf-output")).toBe(
      "reports/ci.xml",
    );
  });

  it("falls back to the default path for an empty or whitespace value", () => {
    expect(resolveJUnitOutputPath("", "qawolf-output")).toBe(
      join("qawolf-output", "junit-report.xml"),
    );
    expect(resolveJUnitOutputPath("   ", "qawolf-output")).toBe(
      join("qawolf-output", "junit-report.xml"),
    );
  });
});

describe("createJUnitReporter", () => {
  it("writes XML to the configured path on run complete", () => {
    const { writes, deps } = makeDeps();
    const reporter = createJUnitReporter(deps);

    reporter.onFlowStart?.({ name: "Login", path: "flows/login.ts" });
    reporter.onFlowPass?.({
      name: "Login",
      path: "flows/login.ts",
      tests: { passed: 1, total: 1 },
      durationMs: 1000,
    });
    reporter.onRunComplete?.({
      summary: makeSummary({ flowsPassed: 1, durationMs: 1000 }),
    });

    expect(writes).toHaveLength(1);
    expect(writes[0]?.path).toBe("/out/junit-report.xml");
    expect(writes[0]?.content).toContain('<?xml version="1.0"');
    expect(writes[0]?.content).toMatch(/<testcase[^>]*name="Login"[^>]*\/>/);
  });

  it("records a failed flow with its error message", () => {
    const { writes, deps } = makeDeps();
    const reporter = createJUnitReporter(deps);

    reporter.onFlowFail?.({
      name: "Checkout",
      path: "flows/checkout.ts",
      err: new Error("Timed out waiting for #submit"),
      tests: { passed: 0, total: 1 },
      durationMs: 500,
      attempt: 1,
      maxAttempts: 1,
    });
    reporter.onRunComplete?.({
      summary: makeSummary({ flowsFailed: 1, durationMs: 500 }),
    });

    const xml = writes[0]?.content ?? "";
    expect(xml).toMatch(/testsuites[^>]*failures="1"/);
    expect(xml).toContain("<failure");
    expect(xml).toContain("Timed out waiting for #submit");
  });

  it("includes the full cause chain in the failure text", () => {
    const { writes, deps } = makeDeps();
    const reporter = createJUnitReporter(deps);

    const cause = new Error("module not found: @qawolf/flows");
    const flowRunErr = new Error('Flow "checkout" failed on attempt 1', {
      cause,
    });

    reporter.onFlowFail?.({
      name: "Checkout",
      path: "flows/checkout.ts",
      err: flowRunErr,
      tests: { passed: 0, total: 0 },
      durationMs: 100,
      attempt: 1,
      maxAttempts: 1,
    });
    reporter.onRunComplete?.({
      summary: makeSummary({ flowsFailed: 1, durationMs: 100 }),
    });

    const xml = writes[0]?.content ?? "";
    expect(xml).toContain("Flow &quot;checkout&quot; failed on attempt 1");
    expect(xml).toContain("module not found: @qawolf/flows");
  });

  it("does not write before the run completes", () => {
    const { writes, deps } = makeDeps();
    const reporter = createJUnitReporter(deps);

    reporter.onFlowPass?.({
      name: "Login",
      path: "flows/login.ts",
      tests: { passed: 1, total: 1 },
      durationMs: 1000,
    });

    expect(writes).toHaveLength(0);
  });

  it("reports the saved path to stderr", () => {
    const { errs, deps } = makeDeps();
    const reporter = createJUnitReporter(deps);

    reporter.onRunComplete?.({ summary: makeSummary() });

    expect(errs.join("")).toContain("/out/junit-report.xml");
  });
});
