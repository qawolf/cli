import {
  maxRunFilesByteLength,
  runFilesByteLength,
} from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import {
  checkRunFiles,
  checkSnippetFiles,
  toCollectedPath,
} from "./runFiles.js";

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
    // A fifth of the content cap, so the six-fold inflation lands past the
    // encoded cap whatever the two caps are set to.
    const escapeHeavy = {
      "data.json": String.fromCharCode(1).repeat(
        Math.ceil(maxRunFilesByteLength / 5),
      ),
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

describe("checkSnippetFiles", () => {
  // Unlike a run, a snippet installs nothing, so demanding a package.json would
  // refuse requests the server would have accepted.
  it("accepts a scope file with no package.json beside it", () => {
    expect(checkSnippetFiles(flow, flowPath)).toEqual({ type: "ok" });
  });

  it("refuses a scope file that is not among the collected files", () => {
    expect(checkSnippetFiles(flow, "elsewhere.ts")).toEqual({
      path: "elsewhere.ts",
      type: "missing-file",
    });
  });

  it("holds a snippet's scope to the same size cap as a run", () => {
    const huge = { "big.ts": "a".repeat(maxRunFilesByteLength) };

    const check = checkSnippetFiles(huge, "big.ts");

    expect(check.type).toBe("too-large");
    if (check.type !== "too-large") return;
    expect(check.maxByteLength).toBe(maxRunFilesByteLength);
  });
});

describe("toCollectedPath", () => {
  it("leaves a path already relative to the collection directory alone", () => {
    expect(toCollectedPath("/workspace", "flows/checkout.flow.ts")).toBe(
      "flows/checkout.flow.ts",
    );
  });

  it("makes an absolute path relative to the collection directory", () => {
    expect(
      toCollectedPath("/workspace", "/workspace/flows/checkout.flow.ts"),
    ).toBe("flows/checkout.flow.ts");
  });

  // Which then fails the presence check, because a file outside the directory
  // is not one that travels.
  it("keeps a path outside the collection directory recognisably outside", () => {
    expect(toCollectedPath("/workspace", "../elsewhere/flow.ts")).toBe(
      "../elsewhere/flow.ts",
    );
  });
});
