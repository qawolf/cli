import { expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { toPosix } from "~/core/repoRelativePath.js";
import { makeDefaultFs } from "./fs.js";
import { makeMemoryFs } from "./fs.testUtils.js";

import { createFlowProgram } from "./flowProgram.js";

it("recognizes native Windows paths after TypeScript normalizes source file names", async () => {
  const bundleDir = await mkdtemp(join(tmpdir(), "qawolf-flow-program-"));
  const sourcePath = join(bundleDir, "a.flow.ts");
  try {
    await writeFile(sourcePath, "export default () => process.env.TOKEN;");
    const windowsPath = sourcePath.replaceAll("/", "\\");
    const result = await createFlowProgram({
      bundleDir,
      sourcePaths: [windowsPath],
    });
    expect(result.flowFiles).toHaveLength(1);
    expect(result.sourceFiles).toHaveLength(1);
    expect(result.isLocalFile(sourcePath.replaceAll("\\", "/"))).toBe(true);
    expect(result.isLocalFile(windowsPath)).toBe(true);
  } finally {
    await rm(bundleDir, { recursive: true, force: true });
  }
});

it.each(["memory", "disk"])(
  "resolves inherited aliases and relative imports using %s files",
  async (storage) => {
    const bundleDir = await mkdtemp(join(tmpdir(), "flow-program-"));
    const fs = storage === "memory" ? makeMemoryFs() : makeDefaultFs();
    const files = {
      "tsconfig.json": JSON.stringify({ extends: "./base.json" }),
      "base.json": JSON.stringify({
        compilerOptions: {
          module: "ESNext",
          moduleResolution: "Bundler",
          baseUrl: ".",
          paths: { "@helpers/*": ["src/lib/*"] },
        },
      }),
      "src/a.flow.ts":
        'import { read } from "@helpers/read"; export default () => read();',
      "src/lib/read.ts": 'export { read } from "./value.js";',
      "src/lib/value.ts":
        "export function read() { return process.env.TOKEN; }",
    };
    try {
      for (const [name, source] of Object.entries(files)) {
        const path = join(bundleDir, name);
        await fs.mkdir(dirname(path), { recursive: true });
        await fs.writeFile(path, source);
      }
      const result = await createFlowProgram({
        bundleDir,
        sourcePaths: Object.keys(files)
          .filter((name) => name.endsWith(".ts"))
          .map((name) => join(bundleDir, name)),
        fs,
      });
      expect(result.flowFiles).toHaveLength(1);
      const declaration = result.flowFiles[0]?.statements.find(
        result.compiler.isImportDeclaration,
      );
      const bindings = declaration?.importClause?.namedBindings;
      if (bindings === undefined || !result.compiler.isNamedImports(bindings))
        throw new Error("missing named import");
      const name = bindings.elements[0]?.name;
      const symbol =
        name === undefined
          ? undefined
          : result.checker.getSymbolAtLocation(name);
      if (symbol === undefined) throw new Error("missing import symbol");
      const target = result.checker.getAliasedSymbol(symbol);
      expect(target.declarations?.[0]?.getSourceFile().fileName).toBe(
        toPosix(join(bundleDir, "src/lib/value.ts")),
      );
    } finally {
      await rm(bundleDir, { recursive: true, force: true });
    }
  },
);
