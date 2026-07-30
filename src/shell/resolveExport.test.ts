import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import { resolveFromEnvDir } from "./resolveExport.js";

function makeTestFs(pkgDir: string, pkg: object): Fs {
  return {
    ...makeDefaultFs(),
    readFileSync: (path: string) => {
      if (path === join(pkgDir, "package.json")) return JSON.stringify(pkg);
      throw Object.assign(
        new Error(`ENOENT: no such file or directory, open '${path}'`),
        { code: "ENOENT", errno: -2 },
      );
    },
  };
}

const envDir = "/project";
const pkgPath = (...segments: string[]) =>
  join(envDir, "node_modules", ...segments);

describe("resolveFromEnvDir", () => {
  describe("unscoped package, root entry", () => {
    it("handles exports as a bare string shorthand", () => {
      const testFs = makeTestFs(pkgPath("pkg"), {
        exports: "./index.js",
      });
      expect(resolveFromEnvDir(envDir, "pkg", "esm", testFs)).toBe(
        pkgPath("pkg", "index.js"),
      );
    });

    it("handles exports as a top-level conditions object", () => {
      const testFs = makeTestFs(pkgPath("pkg"), {
        exports: { import: "./esm.js", require: "./cjs.js" },
      });
      expect(resolveFromEnvDir(envDir, "pkg", "esm", testFs)).toBe(
        pkgPath("pkg", "esm.js"),
      );
    });

    it("returns path from string export", () => {
      const testFs = makeTestFs(pkgPath("playwright"), {
        exports: { ".": "./index.js" },
      });
      expect(resolveFromEnvDir(envDir, "playwright", "esm", testFs)).toBe(
        pkgPath("playwright", "index.js"),
      );
    });

    it("prefers import over require over default in object entry", () => {
      const testFs = makeTestFs(pkgPath("pkg"), {
        exports: {
          ".": { import: "./esm.js", require: "./cjs.js", default: "./def.js" },
        },
      });
      expect(resolveFromEnvDir(envDir, "pkg", "esm", testFs)).toBe(
        pkgPath("pkg", "esm.js"),
      );
    });

    it("falls back to require when import is absent", () => {
      const testFs = makeTestFs(pkgPath("pkg"), {
        exports: { ".": { require: "./cjs.js", default: "./def.js" } },
      });
      expect(resolveFromEnvDir(envDir, "pkg", "esm", testFs)).toBe(
        pkgPath("pkg", "cjs.js"),
      );
    });

    it("falls back to default when import and require are absent", () => {
      const testFs = makeTestFs(pkgPath("pkg"), {
        exports: { ".": { default: "./def.js" } },
      });
      expect(resolveFromEnvDir(envDir, "pkg", "esm", testFs)).toBe(
        pkgPath("pkg", "def.js"),
      );
    });

    it("falls back to module field when exports map is absent", () => {
      const testFs = makeTestFs(pkgPath("pkg"), {
        module: "./esm.js",
        main: "./cjs.js",
      });
      expect(resolveFromEnvDir(envDir, "pkg", "esm", testFs)).toBe(
        pkgPath("pkg", "esm.js"),
      );
    });

    it("falls back to main field when exports and module are absent", () => {
      const testFs = makeTestFs(pkgPath("pkg"), {
        main: "./index.js",
      });
      expect(resolveFromEnvDir(envDir, "pkg", "esm", testFs)).toBe(
        pkgPath("pkg", "index.js"),
      );
    });
  });

  describe("scoped package, root entry", () => {
    it("resolves @scope/pkg correctly", () => {
      const testFs = makeTestFs(pkgPath("@qawolf", "testkit"), {
        exports: { ".": "./dist/index.js" },
      });
      expect(resolveFromEnvDir(envDir, "@qawolf/testkit", "esm", testFs)).toBe(
        pkgPath("@qawolf", "testkit", "dist", "index.js"),
      );
    });
  });

  describe("subpath entry", () => {
    it("resolves @scope/pkg/subpath correctly", () => {
      const testFs = makeTestFs(pkgPath("@qawolf", "testkit"), {
        exports: {
          ".": "./dist/index.js",
          "./client": { import: "./dist/client.js" },
        },
      });
      expect(
        resolveFromEnvDir(envDir, "@qawolf/testkit/client", "esm", testFs),
      ).toBe(pkgPath("@qawolf", "testkit", "dist", "client.js"));
    });

    it("resolves unscoped pkg/subpath correctly", () => {
      const testFs = makeTestFs(pkgPath("playwright"), {
        exports: {
          ".": "./index.js",
          "./test": "./test.js",
        },
      });
      expect(resolveFromEnvDir(envDir, "playwright/test", "esm", testFs)).toBe(
        pkgPath("playwright", "test.js"),
      );
    });
  });

  describe("cjs preference", () => {
    it("prefers require over import in cjs mode", () => {
      const testFs = makeTestFs(pkgPath("pkg"), {
        exports: {
          ".": {
            import: "./esm.mjs",
            require: "./cjs.js",
            default: "./def.js",
          },
        },
      });
      expect(resolveFromEnvDir(envDir, "pkg", "cjs", testFs)).toBe(
        pkgPath("pkg", "cjs.js"),
      );
    });

    it("falls back to default when require is absent in cjs mode", () => {
      const testFs = makeTestFs(pkgPath("pkg"), {
        exports: { ".": { import: "./esm.mjs", default: "./def.js" } },
      });
      expect(resolveFromEnvDir(envDir, "pkg", "cjs", testFs)).toBe(
        pkgPath("pkg", "def.js"),
      );
    });

    it("falls back to import as last resort in cjs mode", () => {
      const testFs = makeTestFs(pkgPath("pkg"), {
        exports: { ".": { import: "./esm.mjs" } },
      });
      expect(resolveFromEnvDir(envDir, "pkg", "cjs", testFs)).toBe(
        pkgPath("pkg", "esm.mjs"),
      );
    });
  });

  describe("nested condition objects", () => {
    it("recurses into nested import condition object", () => {
      const testFs = makeTestFs(pkgPath("pkg"), {
        exports: {
          ".": {
            import: { types: "./index.d.ts", default: "./esm.js" },
            require: "./cjs.js",
          },
        },
      });
      expect(resolveFromEnvDir(envDir, "pkg", "esm", testFs)).toBe(
        pkgPath("pkg", "esm.js"),
      );
    });

    it("recurses into nested require condition object in cjs mode", () => {
      const testFs = makeTestFs(pkgPath("pkg"), {
        exports: {
          ".": {
            require: { types: "./index.d.ts", default: "./cjs.js" },
          },
        },
      });
      expect(resolveFromEnvDir(envDir, "pkg", "cjs", testFs)).toBe(
        pkgPath("pkg", "cjs.js"),
      );
    });
  });

  describe("error cases", () => {
    it("throws when subpath entry is missing from exports map", () => {
      const testFs = makeTestFs(pkgPath("pkg"), {
        exports: { ".": "./index.js" },
      });
      expect(() =>
        resolveFromEnvDir(envDir, "pkg/missing", "esm", testFs),
      ).toThrow(
        `No entry for "./missing" in exports of ${pkgPath("pkg", "package.json")}`,
      );
    });

    it("throws when root entry is absent and no main/module fallback", () => {
      const testFs = makeTestFs(pkgPath("pkg"), {
        exports: { "./other": "./other.js" },
      });
      expect(() => resolveFromEnvDir(envDir, "pkg", "esm", testFs)).toThrow(
        `No entry for "." in exports of ${pkgPath("pkg", "package.json")}`,
      );
    });

    it("throws a package-not-found message when package.json is missing (ENOENT)", () => {
      const testFs: Fs = {
        ...makeDefaultFs(),
        readFileSync: () => {
          throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
        },
      };
      expect(() =>
        resolveFromEnvDir(envDir, "missing-pkg", "esm", testFs),
      ).toThrow(
        `Package 'missing-pkg' not found in ${join(envDir, "node_modules")}`,
      );
    });
  });
});
