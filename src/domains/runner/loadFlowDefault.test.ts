import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { loadFlowDefault, rewriteFlowImports } from "./loadFlowDefault.js";

// ── rewriteFlowImports ────────────────────────────────────────────────────────

describe("rewriteFlowImports", () => {
  const resolve = (s: string) =>
    `file:///resolved/${s.replace("@qawolf/", "")}`;

  it("rewrites static from import of root specifier", () => {
    const out = rewriteFlowImports(
      `import { foo } from '@qawolf/flows';`,
      resolve,
    );
    expect(out).toBe(`import { foo } from 'file:///resolved/flows';`);
  });

  it("rewrites static from import of subpath specifier", () => {
    const out = rewriteFlowImports(
      `import { bar } from '@qawolf/flows/helpers';`,
      resolve,
    );
    expect(out).toBe(`import { bar } from 'file:///resolved/flows/helpers';`);
  });

  it("rewrites re-export (export ... from) of subpath", () => {
    const out = rewriteFlowImports(
      `export { baz } from '@qawolf/flows/utils';`,
      resolve,
    );
    expect(out).toBe(`export { baz } from 'file:///resolved/flows/utils';`);
  });

  it("rewrites dynamic import() of root specifier", () => {
    const out = rewriteFlowImports(`import('@qawolf/flows')`, resolve);
    expect(out).toBe(`import('file:///resolved/flows')`);
  });

  it("rewrites dynamic import() of subpath specifier", () => {
    const out = rewriteFlowImports(`import('@qawolf/flows/client')`, resolve);
    expect(out).toBe(`import('file:///resolved/flows/client')`);
  });

  it("leaves specifier unchanged when resolve throws", () => {
    const out = rewriteFlowImports(`import {} from '@qawolf/flows';`, () => {
      throw new Error("not found");
    });
    expect(out).toBe(`import {} from '@qawolf/flows';`);
  });

  it("does not rewrite unrelated imports", () => {
    const src = `import { x } from 'playwright';\nimport { y } from '@qawolf/testkit';`;
    expect(rewriteFlowImports(src, resolve)).toBe(src);
  });

  it("rewrites double-quoted specifiers", () => {
    const out = rewriteFlowImports(`import foo from "@qawolf/flows";`, resolve);
    expect(out).toBe(`import foo from "file:///resolved/flows";`);
  });
});

// ── loadFlowDefault ───────────────────────────────────────────────────────────

describe("loadFlowDefault", () => {
  it("returns the default export when present", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "load-flow-test-"));
    try {
      await writeFile(
        path.join(tmp, "flow.mjs"),
        "export default { name: 'test-flow' };\n",
      );
      const result = await loadFlowDefault<{ name: string }>(
        path.join(tmp, "flow.mjs"),
      );
      expect(result).toEqual({ name: "test-flow" });
    } finally {
      await rm(tmp, { recursive: true });
    }
  });

  it("throws when default export is absent", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "load-flow-test-"));
    try {
      await writeFile(path.join(tmp, "flow.mjs"), "export const foo = 1;\n");
      let caught: unknown;
      try {
        await loadFlowDefault<unknown>(path.join(tmp, "flow.mjs"));
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toMatch(/No default export found in "/);
    } finally {
      await rm(tmp, { recursive: true });
    }
  });
});

describe("loadFlowDefault (compiled binary mode)", () => {
  afterEach(() => {
    delete process.env.QAWOLF_COMPILED;
  });

  async function makeEnv() {
    const tmp = await mkdtemp(path.join(tmpdir(), "load-flow-compiled-"));
    const flowsDir = path.join(tmp, "node_modules", "@qawolf", "flows");
    await mkdir(flowsDir, { recursive: true });
    await writeFile(
      path.join(flowsDir, "package.json"),
      JSON.stringify({
        exports: { ".": "./index.js", "./helpers": "./helpers.js" },
      }),
    );
    await writeFile(
      path.join(flowsDir, "index.js"),
      "export const flows = {};\n",
    );
    await writeFile(
      path.join(flowsDir, "helpers.js"),
      "export const help = true;\n",
    );
    const flowsDir2 = path.join(tmp, "flows");
    await mkdir(flowsDir2, { recursive: true });
    return { tmp, flowsDir2 };
  }

  it("rewrites and imports a flow that uses root @qawolf/flows", async () => {
    process.env.QAWOLF_COMPILED = "true";
    const { tmp, flowsDir2 } = await makeEnv();
    try {
      const flowPath = path.join(flowsDir2, "flow.mjs");
      await writeFile(
        flowPath,
        `import {} from '@qawolf/flows';\nexport default { ok: true };\n`,
      );
      const result = await loadFlowDefault<{ ok: boolean }>(flowPath);
      expect(result).toEqual({ ok: true });
    } finally {
      await rm(tmp, { recursive: true });
    }
  });

  it("rewrites and imports a flow that uses a @qawolf/flows subpath", async () => {
    process.env.QAWOLF_COMPILED = "true";
    const { tmp, flowsDir2 } = await makeEnv();
    try {
      const flowPath = path.join(flowsDir2, "flow.mjs");
      await writeFile(
        flowPath,
        `import {} from '@qawolf/flows/helpers';\nexport default { sub: true };\n`,
      );
      const result = await loadFlowDefault<{ sub: boolean }>(flowPath);
      expect(result).toEqual({ sub: true });
    } finally {
      await rm(tmp, { recursive: true });
    }
  });

  it("sources the data: URI back to the original flow path", async () => {
    process.env.QAWOLF_COMPILED = "true";
    const { tmp, flowsDir2 } = await makeEnv();
    try {
      const flowPath = path.join(flowsDir2, "flow.mjs");
      await writeFile(
        flowPath,
        `import {} from '@qawolf/flows';\nexport default 42;\n`,
      );
      const result = await loadFlowDefault<number>(flowPath);
      expect(result).toBe(42);
    } finally {
      await rm(tmp, { recursive: true });
    }
  });

  it("falls back to direct file import when no @qawolf/flows imports present", async () => {
    process.env.QAWOLF_COMPILED = "true";
    const { tmp, flowsDir2 } = await makeEnv();
    try {
      const flowPath = path.join(flowsDir2, "flow.mjs");
      await writeFile(flowPath, `export default { plain: true };\n`);
      const result = await loadFlowDefault<{ plain: boolean }>(flowPath);
      expect(result).toEqual({ plain: true });
    } finally {
      await rm(tmp, { recursive: true });
    }
  });
});
