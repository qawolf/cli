import { doctorMessages } from "~/core/messages/index.js";
import type { CheckResult } from "~/domains/doctor/types.js";

type NodeVersionDeps = {
  readonly processVersion: string;
  readonly enginesNode: string;
};

export async function checkNodeVersion(
  deps: NodeVersionDeps,
): Promise<CheckResult> {
  const min = parseVersion(
    deps.enginesNode,
    /^>=\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?/,
  );
  if (min === undefined) {
    return {
      name: "node-version",
      status: "fail",
      detail: doctorMessages.nodeVersion.couldNotParseEngines(deps.enginesNode),
    };
  }

  const actual = parseVersion(
    deps.processVersion,
    /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/,
  );
  if (actual === undefined) {
    return {
      name: "node-version",
      status: "fail",
      detail: doctorMessages.nodeVersion.couldNotParseVersion(
        deps.processVersion,
      ),
    };
  }

  if (compareVersions(actual, min) < 0) {
    return {
      name: "node-version",
      status: "fail",
      detail: doctorMessages.nodeVersion.belowRequired(
        deps.processVersion,
        deps.enginesNode,
      ),
      version: deps.processVersion.replace(/^v/, ""),
    };
  }

  return {
    name: "node-version",
    status: "pass",
    version: deps.processVersion.replace(/^v/, ""),
  };
}

type Version = readonly [major: number, minor: number, patch: number];

/**
 * Parses `major[.minor[.patch]]` from the head of a version or range string,
 * defaulting missing minor/patch to 0 (so `>=20` means `20.0.0`). Returns
 * undefined when no leading major number is present.
 */
function parseVersion(input: string, pattern: RegExp): Version | undefined {
  const match = input.trim().match(pattern);
  if (match?.[1] === undefined) return undefined;
  return [
    Number.parseInt(match[1], 10),
    match[2] === undefined ? 0 : Number.parseInt(match[2], 10),
    match[3] === undefined ? 0 : Number.parseInt(match[3], 10),
  ];
}

/** Standard tuple comparison: negative when `a` precedes `b`. */
function compareVersions(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}
