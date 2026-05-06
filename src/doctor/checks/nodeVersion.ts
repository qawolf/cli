import type { CheckResult } from "~/doctor/types.js";

type NodeVersionDeps = {
  readonly processVersion: string;
  readonly enginesNode: string;
};

export async function checkNodeVersion(
  deps: NodeVersionDeps,
): Promise<CheckResult> {
  const minMajor = parseMinMajor(deps.enginesNode);
  if (minMajor === undefined) {
    return {
      name: "node-version",
      status: "fail",
      detail: `Could not parse engines.node "${deps.enginesNode}"`,
    };
  }

  const actual = parseMajor(deps.processVersion);
  if (actual === undefined) {
    return {
      name: "node-version",
      status: "fail",
      detail: `Could not parse Node version "${deps.processVersion}"`,
    };
  }

  if (actual < minMajor) {
    return {
      name: "node-version",
      status: "fail",
      detail: `Node ${deps.processVersion} is below required ${deps.enginesNode}`,
    };
  }

  return { name: "node-version", status: "pass" };
}

function parseMinMajor(constraint: string): number | undefined {
  const captured = constraint.trim().match(/^>=\s*(\d+)/)?.[1];
  return captured === undefined ? undefined : Number.parseInt(captured, 10);
}

function parseMajor(version: string): number | undefined {
  const captured = version.trim().match(/^v?(\d+)/)?.[1];
  return captured === undefined ? undefined : Number.parseInt(captured, 10);
}
