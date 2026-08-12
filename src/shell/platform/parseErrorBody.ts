/**
 * Longest server message we will surface. Anything longer is almost certainly
 * a stack trace rather than a reason a caller can act on.
 */
const defaultMaxLength = 1024;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// tRPC wraps the reason as {"error":{"json":{"message":"..."}}}; superjson is
// what adds the `json` level, so answer to both with and without it. Older
// non-tRPC endpoints answer with a flat {"error":"..."}.
function extractMessage(parsed: unknown): string | undefined {
  const root = asRecord(parsed);
  if (!root) return undefined;

  const flat = asString(root["error"]);
  if (flat !== undefined) return flat;

  const error = asRecord(root["error"]);
  if (!error) return undefined;

  const json = asRecord(error["json"]);
  return asString(json?.["message"]) ?? asString(error["message"]);
}

/**
 * Pulls the server's own explanation out of an error response body.
 *
 * Only the envelope's `message` field is read — a raw body may be a proxy's
 * HTML or a stack trace, neither of which belongs in CLI output. Returns ""
 * when the body is empty, is not JSON, or carries no message.
 */
export function parseErrorBody(
  body: string,
  maxLength = defaultMaxLength,
): string {
  if (!body) return "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return "";
  }

  const message = extractMessage(parsed)?.trim();
  if (!message) return "";
  return clip(message, maxLength);
}

// The ellipsis counts toward the limit, so the result is never longer than
// `maxLength` — including a limit with no room for anything but the ellipsis.
function clip(message: string, maxLength: number): string {
  if (message.length <= maxLength) return message;
  return maxLength < 1 ? "" : `${message.slice(0, maxLength - 1)}…`;
}
