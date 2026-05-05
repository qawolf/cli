import { describe, expect, it } from "bun:test";

import { formatCIError } from "./ci.js";

describe("formatCIError", () => {
  it("formats error with title only", () => {
    const result = formatCIError("Something went wrong.");
    expect(result).toBe("\nERROR  Something went wrong.\n");
  });

  it("formats error with title and body", () => {
    const result = formatCIError("API key not found.", "Set QAWOLF_API_KEY.");
    expect(result).toBe("\nERROR  API key not found.\n\nSet QAWOLF_API_KEY.\n");
  });

  it("formats multiline body", () => {
    const result = formatCIError("Error.", "Line 1\nLine 2\nLine 3");
    expect(result).toBe("\nERROR  Error.\n\nLine 1\nLine 2\nLine 3\n");
  });
});
