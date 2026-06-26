import { join } from "node:path";

import { globSync } from "tinyglobby";

/**
 * Strings that must NEVER appear in case-08 output — each is a regression of the
 * inner-hop version-shadowing fix or the binary native-module load.
 */
const case08ForbiddenStrings = [
  "FILE_HEADERS_ONLY",
  'Could not load the "sharp" module',
  "Cannot find package",
] as const;

export type JunitSummary = {
  readonly tests: number;
  readonly failures: number;
  readonly errors: number;
};

/** Parses the root `testsuites` counts; undefined when no JUnit was produced. */
export function parseJunit(xml: string): JunitSummary | undefined {
  const tests = matchCount(xml, "tests");
  if (tests === undefined) return undefined;
  return {
    tests,
    failures: matchCount(xml, "failures") ?? 0,
    errors: matchCount(xml, "errors") ?? 0,
  };
}

function matchCount(xml: string, attr: string): number | undefined {
  const value = xml.match(new RegExp(`${attr}="(\\d+)"`))?.[1];
  return value === undefined ? undefined : Number(value);
}

/**
 * Reasons the CLI run itself failed: non-zero exit, missing JUnit, zero tests
 * (the flow never executed — guards against a silent green), or any
 * failures/errors.
 */
export function assertExitAndJunit(
  exitCode: number,
  junit: JunitSummary | undefined,
): string[] {
  const reasons: string[] = [];
  if (exitCode !== 0) reasons.push(`CLI exited ${exitCode}, expected 0`);
  if (junit === undefined) {
    reasons.push("no JUnit output produced");
    return reasons;
  }
  if (junit.tests < 1)
    reasons.push("JUnit reported 0 tests — flow did not run");
  if (junit.failures > 0)
    reasons.push(`JUnit reported ${junit.failures} failure(s)`);
  if (junit.errors > 0) reasons.push(`JUnit reported ${junit.errors} error(s)`);
  return reasons;
}

/**
 * Mirrors the run-all.sh `find` for node_modules outside the .qawolf cache: any
 * node_modules dir written into the project (outside the isolated .qawolf cache)
 * is pollution.
 */
export function scanPollution(projectDir: string): string[] {
  const matches = globSync("**/node_modules", {
    cwd: projectDir,
    onlyDirectories: true,
    dot: true,
    ignore: ["**/.qawolf/**"],
  });
  return matches.map((match) => join(projectDir, match));
}

/**
 * For the native+versioned case only, fails if output contains any forbidden
 * regression string. Keyed off the shape name ("08" / "native"); other cases
 * return no reasons.
 */
export function assertCase08Strings(
  shapeName: string,
  output: string,
): string[] {
  const isNativeVersionedCase =
    shapeName.includes("08") || shapeName.includes("native");
  if (!isNativeVersionedCase) return [];
  return case08ForbiddenStrings
    .filter((forbidden) => output.includes(forbidden))
    .map((forbidden) => `output contains forbidden string: ${forbidden}`);
}
