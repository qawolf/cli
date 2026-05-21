export function buildPatternArgs(pattern: string | undefined): string[] {
  return pattern ? [pattern] : [];
}
