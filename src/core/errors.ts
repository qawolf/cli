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

const missingPackagePattern = /Cannot find (?:package|module) '([^']+)'/;

/**
 * The package name from a Node "Cannot find package 'x'" / "Cannot find
 * module 'x'" resolution error text, or undefined when the text is not a
 * module-resolution failure.
 */
export function extractMissingPackage(text: string): string | undefined {
  return missingPackagePattern.exec(text)?.[1];
}
