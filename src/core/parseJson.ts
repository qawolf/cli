/** JSON text as a value, or undefined where it is not JSON at all. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
