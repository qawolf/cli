import type { CheckResult } from "~/domains/doctor/types.js";

type NodeVersionDeps = {
  readonly processVersion: string;
  readonly enginesNode: string;
};

export async function checkNodeVersion(
  deps: NodeVersionDeps,
): Promise<CheckResult> {
  const minMajor = extractMajor(deps.enginesNode, /^>=\s*(\d+)/);
  if (minMajor === undefined) {
    return {
      name: "node-version",
      status: "fail",
      detail: `Could not parse engines.node "${deps.enginesNode}"`,
    };
  }

  const actual = extractMajor(deps.processVersion, /^v?(\d+)/);
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

  return {
    name: "node-version",
    status: "pass",
    version: deps.processVersion.replace(/^v/, ""),
  };
}

function extractMajor(input: string, pattern: RegExp): number | undefined {
  const captured = input.trim().match(pattern)?.[1];
  return captured === undefined ? undefined : Number.parseInt(captured, 10);
}
