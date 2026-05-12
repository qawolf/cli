export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function isNoEntError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  );
}
