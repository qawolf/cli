export type TsconfigPaths = Record<string, string[]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTsconfigPaths(value: unknown): value is TsconfigPaths {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (targets) =>
        Array.isArray(targets) &&
        targets.every((target) => typeof target === "string"),
    )
  );
}

/** An unreadable tsconfig contributes no aliases rather than failing the run. */
export function parseTsconfigPaths(
  tsconfigContent: string,
): TsconfigPaths | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(tsconfigContent);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) return undefined;

  const compilerOptions = parsed["compilerOptions"];
  if (!isRecord(compilerOptions)) return undefined;

  const paths = compilerOptions["paths"];
  return isTsconfigPaths(paths) ? paths : undefined;
}

/**
 * Only the first target of the first matching pattern, as the socket path does.
 * Honouring the rest would ship a different file set than a socket run.
 */
export function resolvePathAlias(
  importPath: string,
  paths: TsconfigPaths | undefined,
): string | undefined {
  if (paths === undefined) return undefined;

  for (const [pattern, targets] of Object.entries(paths)) {
    const prefix = pattern.replace("*", "");
    if (!importPath.startsWith(prefix)) continue;
    const [target] = targets;
    if (target !== undefined) {
      return target.replace("*", importPath.slice(prefix.length));
    }
  }
  return undefined;
}
