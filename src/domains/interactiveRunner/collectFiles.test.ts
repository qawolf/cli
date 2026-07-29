import { describe, expect, it } from "bun:test";

import { collectRunFiles } from "./collectFiles.js";
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
