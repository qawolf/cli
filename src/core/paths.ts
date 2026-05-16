import envPaths from "env-paths";

let _paths: ReturnType<typeof envPaths> | undefined;

export function getConfigDir(): string {
  _paths ??= envPaths("qawolf");
  return _paths.config;
}
