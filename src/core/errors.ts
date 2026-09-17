export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * The `code` of an error-like value (e.g. `ENOENT`, `ERR_MODULE_NOT_FOUND`), or
 * undefined when the value carries no string `code`.
 */
export function errorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null || !("code" in err)) {
    return undefined;
  }
  const { code } = err;
  return typeof code === "string" ? code : undefined;
}

export function isNoEntError(err: unknown): boolean {
  return errorCode(err) === "ENOENT";
}

export function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.name === "TimeoutError";
}

const missingPackagePattern = /Cannot find (?:package|module) '([^']+)'/;
const pathLikeSpecifierPattern = /^(?:\.|\/|[A-Za-z]:[\\/])/;
const sourceFileSpecifierPattern = /\.(?:[cm]?[jt]sx?)$/;

export type MissingSpecifier =
  | { kind: "package"; specifier: string }
  | { kind: "path-alias"; specifier: string };

export function extractMissingSpecifier(
  text: string,
): MissingSpecifier | undefined {
  const specifier = missingPackagePattern.exec(text)?.[1];
  if (specifier === undefined || pathLikeSpecifierPattern.test(specifier)) {
    return undefined;
  }
  return sourceFileSpecifierPattern.test(specifier)
    ? { kind: "path-alias", specifier }
    : { kind: "package", specifier };
}
