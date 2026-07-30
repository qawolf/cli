const installRemedy =
  "Run `qawolf install` to install the runtime dependencies.";

export function toolNotInstalled(tool: string, path?: string): string {
  const located =
    path === undefined
      ? `${tool} is not installed.`
      : `${tool} not found at ${path}.`;
  return `${located}\n${installRemedy}`;
}

export function toolNotRunnable(what: string, detail: string): string {
  return `${what} (${detail}).\n${installRemedy}`;
}

export function packageLoadFailed(
  pkg: string,
  envDir: string,
  detail: string,
): string {
  return toolNotRunnable(`Could not load ${pkg} from ${envDir}`, detail);
}
