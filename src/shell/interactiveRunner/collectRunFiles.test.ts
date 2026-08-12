import { afterEach, describe, expect, it } from "bun:test";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { makeDefaultFs } from "~/shell/fs.js";

import { collectRunFiles } from "./collectRunFiles.js";

// A real directory rather than the in-memory Fs: the walk is tinyglobby's, and
// what is under test is exactly which real paths it hands to the predicate.
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function makeWorkspace(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "qawolf-collect-"));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
  return root;
}

async function collect(files: Record<string, string>): Promise<string[]> {
  const collected = await collectRunFiles({
    cwd: makeWorkspace(files),
    fs: makeDefaultFs(),
  });
  return Object.keys(collected);
}

describe("collectRunFiles", () => {
  it("collects source and configuration, with contents", async () => {
    const cwd = makeWorkspace({
      "flows/checkout.flow.ts": "export default {};",
      "package.json": '{"name":"project"}',
      "tsconfig.json": "{}",
    });

    const collected = await collectRunFiles({ cwd, fs: makeDefaultFs() });

    expect(collected).toEqual({
      "flows/checkout.flow.ts": "export default {};",
      "package.json": '{"name":"project"}',
      "tsconfig.json": "{}",
    });
  });

  it("leaves behind what the travel rule refuses", async () => {
    expect(
      await collect({
        ".env": "SECRET=1",
        ".qawolf/staging/cached.ts": "export default {};",
        "README.md": "docs",
        "flow.ts": "export default {};",
        "node_modules/left-pad/index.js": "module.exports = 1;",
        "package.json": "{}",
        "screenshot.png": "binary",
      }),
    ).toEqual(["flow.ts", "package.json"]);
  });

  it("collects every extension a runner can read", async () => {
    expect(
      await collect({
        "a.cjs": "1",
        "b.js": "1",
        "c.json": "1",
        "d.mjs": "1",
        "e.ts": "1",
        "f.tsx": "1",
      }),
    ).toEqual(["a.cjs", "b.js", "c.json", "d.mjs", "e.ts", "f.tsx"]);
  });

  // Everything else the travel rule refuses is refused by the glob first, so this
  // is the case that proves the predicate is what decides. A control character in
  // a name is matched by `**/*.ts` and rejected only by `isShippableRunFilePath`.
  //
  // Windows filenames cannot hold a control character at all, so there the file
  // cannot be written to test with. Every other path the predicate alone refuses
  // is likewise unwritable there — a backslash separates, `.` and `..` name
  // directories — which leaves nothing to assert on that platform.
  it.skipIf(process.platform === "win32")(
    "leaves behind a path only the predicate refuses",
    async () => {
      expect(
        await collect({
          [`bad${String.fromCharCode(1)}name.ts`]: "export default {};",
          "flow.ts": "export default {};",
          "package.json": "{}",
        }),
      ).toEqual(["flow.ts", "package.json"]);
    },
  );

  it("collects nothing from an empty directory", async () => {
    expect(await collect({})).toEqual([]);
  });

  // A symlink reads as whatever it points at, which can be outside the working
  // directory entirely. A run must not ship files from elsewhere on the machine.
  it.skipIf(process.platform === "win32")(
    "leaves behind a symbolic link to a file outside the directory",
    async () => {
      const outside = mkdtempSync(join(tmpdir(), "qawolf-outside-"));
      roots.push(outside);
      writeFileSync(join(outside, "secret.ts"), "export const secret = 1;");
      const cwd = makeWorkspace({
        "flow.ts": "export default {};",
        "package.json": "{}",
      });
      symlinkSync(join(outside, "secret.ts"), join(cwd, "linked.ts"));

      const collected = await collectRunFiles({ cwd, fs: makeDefaultFs() });

      expect(Object.keys(collected)).toEqual(["flow.ts", "package.json"]);
    },
  );
});
