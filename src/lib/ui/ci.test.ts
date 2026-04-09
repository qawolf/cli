import { describe, expect, it } from "vitest";

import { formatCIError } from "./ci.js";

describe("formatCIError", () => {
  it("formats error with title only", () => {
    const result = formatCIError("Something went wrong.");
    expect(result).toBe("\n  ERROR  Something went wrong.\n");
  });

  it("formats error with title and body", () => {
    const result = formatCIError("API key not found.", "Set QAWOLF_API_KEY.");
    expect(result).toBe(
      "\n  ERROR  API key not found.\n\n  Set QAWOLF_API_KEY.\n",
    );
  });

  it("formats multiline body with indentation", () => {
    const result = formatCIError("Error.", "Line 1\nLine 2\nLine 3");
    expect(result).toBe("\n  ERROR  Error.\n\n  Line 1\n  Line 2\n  Line 3\n");
  });
});
