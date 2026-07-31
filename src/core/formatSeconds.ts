/**
 * A millisecond duration as whole seconds, for messages about deadlines the
 * caller chose in seconds and should recognize as the number they set.
 */
export function formatSeconds(ms: number): string {
  return `${Math.round(ms / 1000)}s`;
}
