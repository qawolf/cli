const installRemedy =
  "Run `qawolf install` to install the runtime dependencies.";

export const clearAndRetry = "Run `qawolf install clear`, then retry.";

// Callers reached after the deps root resolved cannot tell the user to run
// `qawolf install` — that is the step which already ran.
export const depsRootIncomplete = `The resolved dependencies directory is incomplete. ${clearAndRetry}`;

function located(tool: string, path: string | undefined): string {
  return path === undefined
    ? `${tool} is not installed.`
    : `${tool} not found at ${path}.`;
}

export function toolNotInstalled(tool: string, path?: string): string {
  return `${located(tool, path)}\n${installRemedy}`;
}

export function toolMissingFromDepsRoot(tool: string, path: string): string {
  return `${located(tool, path)}\n${depsRootIncomplete}`;
}
