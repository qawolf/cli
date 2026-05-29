import { describe, expect, it } from "bun:test";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import {
  makeSink as sink,
  makeSummary,
} from "~/shell/reporter/reporter.testUtils.js";

import { buildRunReporter } from "./buildRunReporter.js";

function drivePassingFlow(reporter: ReturnType<typeof buildRunReporter>): void {
  reporter.onFlowPass?.({
    name: "Login",
    path: "flows/login.ts",
    tests: { passed: 1, total: 1 },
    durationMs: 1000,
  });
  reporter.onRunComplete?.({ summary: makeSummary() });
}

describe("buildRunReporter", () => {
  it("writes a JUnit file through the injected fs, creating the output dir", () => {
    const fs = makeMemoryFs();
    const reporter = buildRunReporter(
      { junit: true, outputDir: "/out/qawolf" },
      { fs, stdout: sink(), stderr: sink() },
    );

    drivePassingFlow(reporter);

    expect(fs.existsSync("/out/qawolf")).toBe(true);
    const xml = fs.readFileSync("/out/qawolf/junit-report.xml");
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toMatch(/<testcase[^>]*name="Login"[^>]*\/>/);
  });

  it("writes no file when --junit is not set", () => {
    const fs = makeMemoryFs();
    const reporter = buildRunReporter(
      { outputDir: "/out/qawolf" },
      { fs, stdout: sink(), stderr: sink() },
    );

    drivePassingFlow(reporter);

    expect(fs.existsSync("/out/qawolf/junit-report.xml")).toBe(false);
  });

  it("treats a bare --junit= (empty string) as enabled with the default path", () => {
    const fs = makeMemoryFs();
    const reporter = buildRunReporter(
      { junit: "", outputDir: "/out/qawolf" },
      { fs, stdout: sink(), stderr: sink() },
    );

    drivePassingFlow(reporter);

    expect(fs.existsSync("/out/qawolf/junit-report.xml")).toBe(true);
  });
});
