import { maxRunFilesByteLength } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { checkRunFiles } from "./runFiles.js";

const packageJson = { content: "{}", path: "package.json" };
const flow = { content: "export default {};", path: "flows/checkout.flow.ts" };

describe("checkRunFiles", () => {
  it("accepts a flow shipped alongside package.json", () => {
    expect(checkRunFiles([packageJson, flow], flow.path)).toEqual({
      type: "ok",
    });
  });

  it("refuses an entry point that is not among the collected files", () => {
    expect(checkRunFiles([packageJson], "flows/missing.flow.ts")).toEqual({
      entryPointPath: "flows/missing.flow.ts",
      type: "missing-entry-point",
    });
  });

  it("refuses files carrying no package.json", () => {
    expect(checkRunFiles([flow], flow.path)).toEqual({
      type: "missing-package-json",
    });
  });

  it("refuses files over the cap the contract publishes", () => {
    const huge = { content: "a".repeat(maxRunFilesByteLength), path: "big.ts" };

    const check = checkRunFiles([packageJson, huge], huge.path);

    expect(check.type).toBe("too-large");
    if (check.type !== "too-large") return;
    expect(check.maxByteLength).toBe(maxRunFilesByteLength);
    expect(check.byteLength).toBeGreaterThan(maxRunFilesByteLength);
  });
});
