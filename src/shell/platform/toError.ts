// Normalize the `unknown` thrown by fetch / AbortSignal.timeout into a real
// Error before wrapping it in a WireError. Shared by every platform client.
export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
