import { afterEach } from "bun:test";

/**
 * Restores `ComSpec` after each test. Tests set it to fake a win32 shell, and
 * a leaked value changes how later tests build command lines.
 */
export function restoreComSpecAfterEach(): void {
  const original = process.env["ComSpec"];
  afterEach(() => {
    if (original === undefined) delete process.env["ComSpec"];
    else process.env["ComSpec"] = original;
  });
}
