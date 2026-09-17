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

export type ParsedTsconfigContent =
  | { type: "parsed"; paths: TsconfigPaths | undefined }
  | { type: "unparseable" };

export function parseTsconfigContent(
  tsconfigContent: string,
): ParsedTsconfigContent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(tsconfigContent);
  } catch {
    return { type: "unparseable" };
  }
  if (!isRecord(parsed)) return { paths: undefined, type: "parsed" };

  const compilerOptions = parsed["compilerOptions"];
  if (!isRecord(compilerOptions)) return { paths: undefined, type: "parsed" };

  const paths = compilerOptions["paths"];
  return {
    paths: isTsconfigPaths(paths) ? paths : undefined,
    type: "parsed",
  };
}

/** An unreadable tsconfig contributes no aliases rather than failing the run. */
export function parseTsconfigPaths(
  tsconfigContent: string,
): TsconfigPaths | undefined {
  const parsed = parseTsconfigContent(tsconfigContent);
  return parsed.type === "parsed" ? parsed.paths : undefined;
}

type WildcardPattern = { prefix: string; suffix: string };

function parseWildcardPattern(pattern: string): WildcardPattern | undefined {
  const wildcard = pattern.indexOf("*");
  if (wildcard === -1 || wildcard !== pattern.lastIndexOf("*"))
    return undefined;

  return {
    prefix: pattern.slice(0, wildcard),
    suffix: pattern.slice(wildcard + 1),
  };
}

function matchesWildcard(
  importPath: string,
  { prefix, suffix }: WildcardPattern,
): boolean {
  return (
    importPath.length >= prefix.length + suffix.length &&
    importPath.startsWith(prefix) &&
    importPath.endsWith(suffix)
  );
}

type WildcardMatch = { pattern: WildcardPattern; targets: string[] };

function longestPrefixMatch(
  importPath: string,
  paths: TsconfigPaths,
): WildcardMatch | undefined {
  return Object.entries(paths)
    .flatMap<WildcardMatch>(([pattern, targets]) => {
      const parsed = parseWildcardPattern(pattern);
      if (parsed === undefined || !matchesWildcard(importPath, parsed)) {
        return [];
      }
      return [{ pattern: parsed, targets }];
    })
    .reduce<WildcardMatch | undefined>(
      (best, candidate) =>
        best === undefined ||
        candidate.pattern.prefix.length > best.pattern.prefix.length
          ? candidate
          : best,
      undefined,
    );
}

export function resolvePathAlias(
  importPath: string,
  paths: TsconfigPaths | undefined,
): string | undefined {
  if (paths === undefined) return undefined;

  const [exactTarget] = paths[importPath] ?? [];
  if (exactTarget !== undefined) return exactTarget;

  const match = longestPrefixMatch(importPath, paths);
  if (match === undefined) return undefined;

  const [target] = match.targets;
  if (target === undefined) return undefined;

  const substituted = importPath.slice(
    match.pattern.prefix.length,
    importPath.length - match.pattern.suffix.length,
  );
  return target.replace("*", substituted);
}
