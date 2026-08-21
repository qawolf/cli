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
const workspaces: string[] = [];

afterEach(() => {
  for (const root of workspaces.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function makeWorkspace(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "qawolf-collect-"));
  workspaces.push(root);
  for (const [path, content] of Object.entries(files)) {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
  return root;
}

const flowPath = "src/flows/checkout.flow.ts";

async function collect(
  files: Record<string, string>,
  roots: readonly string[] = [flowPath],
) {
  return collectRunFiles({
    cwd: makeWorkspace(files),
    fs: makeDefaultFs(),
    roots,
  });
}

const pathsOf = async (
  files: Record<string, string>,
  roots?: readonly string[],
) => Object.keys((await collect(files, roots)).files).sort();

describe("collectRunFiles", () => {
  it("collects the entry point, what it imports, and the two fixed files", async () => {
    expect(
      await pathsOf({
        "package.json": "{}",
        "src/flows/checkout.flow.ts": 'import "../pages/login";',
        "src/pages/login.ts": "export const login = 1;",
        "tsconfig.json": "{}",
      }),
    ).toEqual([
      "package.json",
      "src/flows/checkout.flow.ts",
      "src/pages/login.ts",
      "tsconfig.json",
    ]);
  });

  it("leaves behind a file the flow does not reach", async () => {
    expect(
      await pathsOf({
        "package.json": "{}",
        "src/flows/checkout.flow.ts": "export default {};",
        "src/flows/unrelated.flow.ts": "export default {};",
        "src/pages/never.ts": "export const never = 1;",
      }),
    ).toEqual(["package.json", "src/flows/checkout.flow.ts"]);
  });

  it("follows a tsconfig path alias", async () => {
    expect(
      await pathsOf({
        "package.json": "{}",
        "src/flows/checkout.flow.ts": 'import "~/pages/login";',
        "src/pages/login.ts": "export const login = 1;",
        "tsconfig.json": '{"compilerOptions":{"paths":{"~/*":["src/*"]}}}',
      }),
    ).toEqual([
      "package.json",
      "src/flows/checkout.flow.ts",
      "src/pages/login.ts",
      "tsconfig.json",
    ]);
  });

  it("terminates on a cycle", async () => {
    expect(
      await pathsOf({
        "package.json": "{}",
        "src/flows/checkout.flow.ts": 'import "../pages/a";',
        "src/pages/a.ts": 'import "./b";',
        "src/pages/b.ts": 'import "./a";',
      }),
    ).toEqual([
      "package.json",
      "src/flows/checkout.flow.ts",
      "src/pages/a.ts",
      "src/pages/b.ts",
    ]);
  });

  it("walks past the first level", async () => {
    expect(
      await pathsOf({
        "package.json": "{}",
        "src/flows/checkout.flow.ts": 'import "../pages/one";',
        "src/pages/one.ts": 'import "./two";',
        "src/pages/three.ts": "export const three = 3;",
        "src/pages/two.ts": 'import "./three";',
      }),
    ).toEqual([
      "package.json",
      "src/flows/checkout.flow.ts",
      "src/pages/one.ts",
      "src/pages/three.ts",
      "src/pages/two.ts",
    ]);
  });

  it("resolves an import written with the other supported extension", async () => {
    expect(
      await pathsOf({
        "package.json": "{}",
        "src/flows/checkout.flow.ts": 'import "../pages/login.js";',
        "src/pages/login.ts": "export const login = 1;",
      }),
    ).toEqual([
      "package.json",
      "src/flows/checkout.flow.ts",
      "src/pages/login.ts",
    ]);
  });

  it("leaves npm packages to the runner to install", async () => {
    expect(
      await pathsOf({
        "package.json": "{}",
        "src/flows/checkout.flow.ts":
          'import "playwright";\nimport "@qawolf/flows";',
      }),
    ).toEqual(["package.json", "src/flows/checkout.flow.ts"]);
  });

  it("reports an import it could not resolve rather than dropping it", async () => {
    const collected = await collect({
      "package.json": "{}",
      "src/flows/checkout.flow.ts": 'import "../pages/missing";',
    });

    expect(collected.unresolvedImports).toEqual([
      {
        importPath: "../pages/missing",
        importingFilePath: "src/flows/checkout.flow.ts",
      },
    ]);
  });

  it("fails when a file the graph reaches cannot be read", async () => {
    expect(
      collect({ "package.json": "{}" }, ["src/flows/gone.flow.ts"]),
    ).rejects.toThrow();
  });

  it("takes more than one root, for a range in another file", async () => {
    expect(
      await pathsOf(
        {
          "package.json": "{}",
          "src/flows/checkout.flow.ts": "export default {};",
          "src/pages/login.ts": "export const login = 1;",
        },
        [flowPath, "src/pages/login.ts"],
      ),
    ).toEqual([
      "package.json",
      "src/flows/checkout.flow.ts",
      "src/pages/login.ts",
    ]);
  });

  it("leaves node_modules and dot directories out of the path set", async () => {
    const collected = await collect({
      ".hidden/secret.ts": "export const secret = 1;",
      "node_modules/dep/index.ts": "export const dep = 1;",
      "package.json": "{}",
      "src/flows/checkout.flow.ts": 'import "../../node_modules/dep";',
    });

    expect(Object.keys(collected.files).sort()).toEqual([
      "package.json",
      "src/flows/checkout.flow.ts",
    ]);
    expect(collected.unresolvedImports).toHaveLength(1);
  });

  it("does not follow a symbolic link out of the working directory", async () => {
    const outside = makeWorkspace({
      "outside.ts": "export const outside = 1;",
    });
    const root = makeWorkspace({
      "package.json": "{}",
      "src/flows/checkout.flow.ts": 'import "../pages/linked";',
    });
    mkdirSync(join(root, "src/pages"), { recursive: true });
    symlinkSync(join(outside, "outside.ts"), join(root, "src/pages/linked.ts"));

    const collected = await collectRunFiles({
      cwd: root,
      fs: makeDefaultFs(),
      roots: [flowPath],
    });

    expect(Object.keys(collected.files)).not.toContain("src/pages/linked.ts");
  });
});
