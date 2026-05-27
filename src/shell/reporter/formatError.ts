export type SerializedError = { message: string; stack?: string };

export function serializeCause(cause: unknown): SerializedError {
  if (cause instanceof Error) {
    return cause.stack
      ? { message: cause.message, stack: cause.stack }
      : { message: cause.message };
  }
  if (typeof cause === "string") return { message: cause };
  if (typeof cause === "object" && cause !== null) {
    const obj = cause as Record<string, unknown>;
    if (typeof obj["message"] === "string") return { message: obj["message"] };
    try {
      return { message: JSON.stringify(cause) };
    } catch {
      // oxlint-disable-next-line @typescript-eslint/no-base-to-string
      return { message: String(cause) };
    }
  }
  // oxlint-disable-next-line @typescript-eslint/no-base-to-string
  return { message: String(cause) };
}

export function flattenErrorChain(err: Error): SerializedError[] {
  const chain: SerializedError[] = [serializeCause(err)];
  // Cycle detection: a self-referential or two-way cause chain would
  // otherwise loop forever, blocking the reporter and hanging the CLI.
  const seen = new Set<Error>([err]);
  let cause: unknown = err.cause;
  while (cause !== undefined && cause !== null) {
    chain.push(serializeCause(cause));
    if (!(cause instanceof Error)) break;
    if (seen.has(cause)) break;
    seen.add(cause);
    cause = cause.cause;
  }
  return chain;
}

export function filterStack(stack: string): string {
  const cwd = process.cwd();
  return stack
    .split("\n")
    .filter((line) => {
      if (!/^\s+at /.test(line)) return true;
      return !line.includes("node_modules") && !line.includes("dist/cli.js");
    })
    .map((line) => {
      if (!/^\s+at /.test(line)) return line;
      return line.replace(`file://${cwd}/`, "").replace(`${cwd}/`, "");
    })
    .join("\n");
}
