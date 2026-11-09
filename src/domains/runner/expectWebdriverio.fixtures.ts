import { mock } from "bun:test";

/**
 * Replaces expect-webdriverio for tests. Bun cannot load the real package: its
 * `expect` dependency has an ESM wrapper that reads `cjsModule.expect` from a
 * default import, and Bun gives that default import as `exports.default`. Node
 * loads it correctly. Bun shares module mocks across test files, so every file
 * that needs the mobile expect must use this one stand-in.
 *
 * The stand-in has only the `toBe` matcher.
 */
export function mockExpectWebdriverio(): void {
  void mock.module("expect-webdriverio", () => ({
    expect: (actual: unknown) => ({
      toBe(expected: unknown) {
        if (actual !== expected)
          throw new Error(
            `expected ${String(expected)}, got ${String(actual)}`,
          );
      },
    }),
    setOptions: () => {},
  }));
}
