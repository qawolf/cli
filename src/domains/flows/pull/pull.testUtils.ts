import { expect } from "bun:test";

export async function expectRejects(
  promise: Promise<unknown>,
  pattern?: RegExp,
): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(Error);
  if (pattern) expect((caught as Error).message).toMatch(pattern);
}
