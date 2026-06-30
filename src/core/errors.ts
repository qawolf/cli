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
