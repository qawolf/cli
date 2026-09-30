/**
 * A swipe's `--from` and `--to` are one point each, typed the way a person
 * reads one off a screenshot.
 */
export function parsePoint(
  flag: "--from" | "--to",
  point: string,
):
  | { ok: true; value: { x: number; y: number } }
  | { ok: false; error: string } {
  const [x, y, ...rest] = point.split(",");
  if (x === undefined || y === undefined || rest.length > 0) {
    return {
      error: `${flag} must be one point as x,y in screenshot pixels, for example 200,800.`,
      ok: false,
    };
  }
  return { ok: true, value: { x: toNumber(x), y: toNumber(y) } };
}

/**
 * `Number("")` and `Number(" ")` are both 0, so an unset shell variable would
 * otherwise reach the runner as a click on the top-left pixel. NaN is what the
 * schema refuses by name, so a blank flag is answered the same way `--x abc` is.
 */
export function toNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}
