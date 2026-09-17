/**
 * What a request asked the platform to find, so a 404 can name that thing
 * rather than blame the environment for every miss.
 */
export type NotFoundSubject =
  | { kind: "runner"; runnerId: string | undefined }
  | { kind: "run"; runId: string | undefined }
  | { kind: "environment" }
  | { kind: "other" };

// `launch` starts a runner and `list` names none, so neither can 404 over a
// runner that has gone. Every other runner route is relayed to one live pod.
const runnerRoutesThatNameNoRunner: ReadonlySet<string> = new Set([
  "runner.launch",
  "runner.list",
]);

// The run routes that resolve one run by id. `run.create` and `run.find` take
// an environment instead, and fall through to the environment rule below.
const runRoutesThatResolveOneRun: ReadonlySet<string> = new Set([
  "run.diagnose",
  "run.get",
  "run.reattempt",
  "run.stop",
]);

function field(input: unknown, name: string): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const value = (input as Record<string, unknown>)[name];
  return typeof value === "string" ? value : undefined;
}

/**
 * Reads the subject off the contract name and the input that was sent, rather
 * than off a hand-kept list of every contract: a route that resolves one runner
 * carries its id, and a route scoped to an environment carries that.
 */
export function notFoundSubject(
  contractName: string,
  input: unknown,
): NotFoundSubject {
  if (
    contractName.startsWith("runner.") &&
    !runnerRoutesThatNameNoRunner.has(contractName)
  ) {
    return { kind: "runner", runnerId: field(input, "id") };
  }
  if (runRoutesThatResolveOneRun.has(contractName)) {
    return { kind: "run", runId: field(input, "runId") };
  }
  if (field(input, "environmentId") !== undefined)
    return { kind: "environment" };
  return { kind: "other" };
}
