import {
  maxRunFilesByteLength,
  runFilesByteLength,
} from "@qawolf/api-contracts/v1";
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

  // Escaping inflates content on the way out — a control character costs one byte
  // of content and six encoded — so a set of files well inside the content cap can
  // still encode to more than a runner accepts. Refused here so the caller is told
  // which cap it broke rather than handed an opaque transport failure.
  it("refuses files that encode to more than a runner accepts", () => {
    const escapeHeavy = {
      "data.json": String.fromCharCode(1).repeat(2 * 1024 * 1024),
    };
    const files = { ...packageJson, ...flow, ...escapeHeavy };

    expect(runFilesByteLength(files)).toBeLessThan(maxRunFilesByteLength);

    const check = checkRunFiles(files, flowPath);

    expect(check.type).toBe("request-too-large");
    if (check.type !== "request-too-large") return;
    expect(check.byteLength).toBeGreaterThan(check.maxByteLength);
  });

  it("refuses an entry point that is not among the collected files", () => {
    expect(checkRunFiles(packageJson, "flows/missing.flow.ts")).toEqual({
      path: "flows/missing.flow.ts",
      type: "missing-file",
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
