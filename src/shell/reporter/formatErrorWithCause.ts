function filterStack(stack: string): string {
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

function renderCause(cause: unknown): string {
  if (cause instanceof Error) return filterStack(cause.stack ?? cause.message);
  if (typeof cause === "object" && cause !== null) {
    const obj = cause as Record<string, unknown>;
    // Duck-type: if it has a string message, treat it as error-like
    if (typeof obj["message"] === "string") return obj["message"];
    try {
      return JSON.stringify(cause);
    } catch {
      // oxlint-disable-next-line @typescript-eslint/no-base-to-string
      return String(cause);
    }
  }
  return String(cause);
}

/** Formats an error and its full cause chain as a single string. */
export function formatErrorWithCause(err: Error): string {
  const parts: string[] = [String(err)];
  let cause: unknown = err.cause;
  while (cause !== undefined && cause !== null) {
    parts.push(`Caused by: ${renderCause(cause)}`);
    if (!(cause instanceof Error)) break;
    cause = cause.cause;
  }
  return parts.join("\n");
}
