import { describe, expect, it } from "bun:test";

import { buildRunSelection } from "./lineSelection.js";

const path = "flows/checkout.flow.ts";

describe("buildRunSelection", () => {
  it("reads a range as two 1-indexed inclusive lines", () => {
    expect(buildRunSelection({ lines: "12-40", path })).toEqual({
      ok: true,
      selection: { endLine: 40, path, startLine: 12 },
    });
  });

  it("takes a single-line range", () => {
    expect(buildRunSelection({ lines: "7-7", path })).toEqual({
      ok: true,
      selection: { endLine: 7, path, startLine: 7 },
    });
  });

  it("tolerates spaces around the dash", () => {
    expect(buildRunSelection({ lines: " 12 - 40 ", path }).ok).toBe(true);
  });

  it("refuses a range that ends before it starts", () => {
    const built = buildRunSelection({ lines: "40-12", path });

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("startLine");
  });

  it("refuses a line that is not a positive whole number", () => {
    expect(buildRunSelection({ lines: "0-4", path }).ok).toBe(false);
    expect(buildRunSelection({ lines: "1.5-4", path }).ok).toBe(false);
    expect(buildRunSelection({ lines: "-1-4", path }).ok).toBe(false);
  });

  it("names the flag's shape when the range is not one", () => {
    const built = buildRunSelection({ lines: "12", path });

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("--lines 12-40");
  });

  it("refuses a path that would not travel to a runner", () => {
    expect(buildRunSelection({ lines: "1-2", path: "../outside.ts" }).ok).toBe(
      false,
    );
  });
});
