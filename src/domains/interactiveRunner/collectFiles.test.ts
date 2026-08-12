import { describe, expect, it } from "bun:test";

import { collectRunFiles, describeRunFilesCheck } from "./collectFiles.js";
import { makeTestDeps } from "./deps.testUtils.js";

describe("collectRunFiles", () => {
  it("collects what the working directory ships", async () => {
    const collected = await collectRunFiles(makeTestDeps());

    expect(collected).toEqual({
      files: { "flow.ts": "export default {};", "package.json": "{}" },
      ok: true,
    });
  });

  // Every shippable file under the working directory is read, so a broken symlink
  // named foo.ts or a file the current user cannot open stops the run. Naming the
  // path is what turns it into something to fix.
  it("names the file it could not read", async () => {
    const unreadable = Object.assign(new Error("EACCES: permission denied"), {
      path: "/workspace/flows/locked.ts",
    });

    const collected = await collectRunFiles(
      makeTestDeps({ collectRunFiles: () => Promise.reject(unreadable) }),
    );

    expect(collected.ok).toBe(false);
    if (collected.ok) return;
    expect(collected.error).toContain("flows/locked.ts");
    expect(collected.error).toContain("permission denied");
  });

  it("still reports a failure that names no path", async () => {
    const collected = await collectRunFiles(
      makeTestDeps({ collectRunFiles: () => Promise.reject(Error("EMFILE")) }),
    );

    expect(collected.ok).toBe(false);
    if (collected.ok) return;
    expect(collected.error).toContain("EMFILE");
  });
});

describe("describeRunFilesCheck", () => {
  it("names the entry point that is not among the collected files", () => {
    expect(
      describeRunFilesCheck({
        entryPointPath: "flows/missing.ts",
        type: "missing-entry-point",
      }),
    ).toContain("flows/missing.ts");
  });

  it("names the largest files when the content cap is broken", () => {
    expect(
      describeRunFilesCheck({
        byteLength: 5_000_000,
        largest: [{ byteLength: 4_900_000, path: "dist/bundle.js" }],
        maxByteLength: 4_194_304,
        type: "too-large",
      }),
    ).toContain("dist/bundle.js");
  });

  // Escaping inflates content on the way out, so this cap can be broken by files
  // that are inside the content one. The message has to say which.
  it("says the request encoding is what was too large", () => {
    expect(
      describeRunFilesCheck({
        byteLength: 12_000_000,
        maxByteLength: 9_437_184,
        type: "request-too-large",
      }),
    ).toContain("encodes to");
  });
});
