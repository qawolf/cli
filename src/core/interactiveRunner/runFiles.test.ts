import { maxRunFilesByteLength } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { checkRunFiles } from "./runFiles.js";

const flowPath = "flows/checkout.flow.ts";
const packageJson = { "package.json": "{}" };
const flow = { [flowPath]: "export default {};" };

describe("checkRunFiles", () => {
  it("accepts a flow shipped alongside package.json", () => {
    expect(checkRunFiles({ ...packageJson, ...flow }, flowPath)).toEqual({
      type: "ok",
    });
  });

  it("refuses an entry point that is not among the collected files", () => {
    expect(checkRunFiles(packageJson, "flows/missing.flow.ts")).toEqual({
      entryPointPath: "flows/missing.flow.ts",
      type: "missing-entry-point",
    });
  });

  it("refuses files carrying no package.json", () => {
    expect(checkRunFiles(flow, flowPath)).toEqual({
      type: "missing-package-json",
    });
  });

  it("refuses files over the cap the contract publishes", () => {
    const huge = { "big.ts": "a".repeat(maxRunFilesByteLength) };

    const check = checkRunFiles({ ...packageJson, ...huge }, "big.ts");

    expect(check.type).toBe("too-large");
    if (check.type !== "too-large") return;
    expect(check.maxByteLength).toBe(maxRunFilesByteLength);
    expect(check.byteLength).toBeGreaterThan(maxRunFilesByteLength);
  });

  // One generated bundle is usually the whole overage, and a caller cannot act on
  // "your files are too big" without being told which of 500 files to look at.
  it("names the biggest files, biggest first, when it refuses for size", () => {
    const bundle = { "dist/bundle.js": "a".repeat(maxRunFilesByteLength) };
    const map = { "dist/bundle.js.map": "b".repeat(1024) };

    const check = checkRunFiles(
      { ...packageJson, ...flow, ...bundle, ...map },
      flowPath,
    );

    expect(check.type).toBe("too-large");
    if (check.type !== "too-large") return;
    expect(check.largest.map((file) => file.path)).toEqual([
      "dist/bundle.js",
      "dist/bundle.js.map",
      "flows/checkout.flow.ts",
    ]);
  });
});
