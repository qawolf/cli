import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assertCase08Strings,
  assertExitAndJunit,
  parseJunit,
  scanPollution,
} from "./assertions.js";
import { materialize } from "./materialize.js";
import { spawnCli } from "./spawnCli.js";
import { createTmpProject } from "./tmpWorkspace.js";
import type { CaseResult, Channel, RepoShape } from "./types.js";

export type RunCaseOptions = {
  readonly noCleanup?: boolean;
};

/**
 * Runs one shape on one channel in a throwaway project dir that shares the run's
 * managed-runtime dir (`runtimeDir`), and collects all assertions into a
 * CaseResult. Always cleans up the project unless `noCleanup`, in which case the
 * retained path is appended to the output.
 */
export async function runCase(
  channel: Channel,
  shape: RepoShape,
  runtimeDir: string,
  options?: RunCaseOptions,
): Promise<CaseResult> {
  const workspace = createTmpProject(runtimeDir);
  try {
    materialize(shape, workspace.projectDir);
    const runCwd = join(workspace.projectDir, shape.runDir);
    const junitPath = join(runCwd, ".junit.xml");
    const startedAt = Date.now();
    const result = await spawnCli(
      channel.command,
      [
        ...channel.prefixArgs,
        "flows",
        "run",
        shape.flowArg,
        "--junit",
        junitPath,
      ],
      { cwd: runCwd, env: workspace.env },
    );
    const durationMs = Date.now() - startedAt;
    const junit = existsSync(junitPath)
      ? parseJunit(readFileSync(junitPath, "utf8"))
      : undefined;
    const pollution = scanPollution(workspace.projectDir);
    const output = `${result.stdout}${result.stderr}`;
    const assertionFailures = [
      ...assertExitAndJunit(result.exitCode, junit),
      ...(pollution.length > 0
        ? [`project pollution: ${pollution.join(", ")}`]
        : []),
      ...assertCase08Strings(shape.name, output),
    ];
    return {
      caseName: shape.name,
      channel: channel.label,
      passed: assertionFailures.length === 0,
      durationMs,
      exitCode: result.exitCode,
      failures: junit?.failures,
      pollution,
      assertionFailures,
      output: options?.noCleanup
        ? `${output}\n[workspace retained: ${workspace.projectDir}]`
        : output,
    };
  } finally {
    if (!options?.noCleanup) workspace.cleanup();
  }
}
