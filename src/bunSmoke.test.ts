import { expect, test } from "bun:test";

import { errorMessage } from "./lib/errors.js";

test("errorMessage returns the error message string", () => {
  expect(errorMessage(new Error("boom"))).toBe("boom");
});
