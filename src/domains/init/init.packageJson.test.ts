import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { flowsVersion } from "~/generated/dependencyVersions.js";
import { handleInit } from "./init.js";
import { makeCtx } from "./init.fixtures.js";

const cwd = "/test/project";
const pkgPath = join(cwd, "package.json");

async function initWithPkg(
  pkg: Record<string, unknown>,
  opts: { yes: boolean } = { yes: true },
) {
  const memFs = makeMemoryFs();
  await memFs.mkdir(cwd, { recursive: true });
  await memFs.writeFile(pkgPath, JSON.stringify(pkg));
  const { ctx, messages } = makeCtx();

  await handleInit(ctx, opts, { cwd, fs: memFs });

  const written = await memFs.readFile(pkgPath);
  return {
    messages,
    written,
    pkg: JSON.parse(written) as Record<string, unknown>,
  };
}

async function initWithRaw(raw: string) {
  const memFs = makeMemoryFs();
  await memFs.mkdir(cwd, { recursive: true });
  await memFs.writeFile(pkgPath, raw);
  const { ctx, messages } = makeCtx();

  await handleInit(ctx, { yes: true }, { cwd, fs: memFs });

  return { messages, written: await memFs.readFile(pkgPath) };
}

describe("handleInit with an existing package.json", () => {
  it.each([["null"], ['"hello"'], ["[1]"]])(
    "warns and leaves valid-JSON-but-not-an-object content %s unchanged",
    async (raw) => {
      const { written, messages } = await initWithRaw(raw);

      expect(written).toBe(raw);
      expect(messages.find((m) => m.method === "warn")?.text).toBe(
        "`package.json` must contain a JSON object. Update it, then run `qawolf init` again.",
      );
    },
  );

  it("skips only the script repair when scripts is not an object", async () => {
    const { pkg, messages } = await initWithPkg({
      name: "app",
      scripts: "broken",
    });

    expect(pkg["scripts"]).toBe("broken");
    expect(pkg["type"]).toBe("module");
    const deps = pkg["dependencies"] as Record<string, string>;
    expect(deps["@qawolf/flows"]).toBe(flowsVersion);
    expect(messages.find((m) => m.method === "warn")?.text).toBe(
      "The `scripts` field in `package.json` must be a JSON object. Update it, then run `qawolf init` again.",
    );
  });

  it("skips only the dependency repair when dependencies is not an object", async () => {
    const { pkg } = await initWithPkg({
      name: "app",
      dependencies: "broken",
    });

    expect(pkg["dependencies"]).toBe("broken");
    expect(pkg["type"]).toBe("module");
    const scripts = pkg["scripts"] as Record<string, string>;
    expect(scripts["test:e2e"]).toBe("qawolf flows run");
  });

  it('sets "type": "module" and adds @qawolf/flows when both are missing', async () => {
    // The npm-init default: no "type", no dependencies — the state the
    // scaffolded ESM flow could not load from.
    const { pkg } = await initWithPkg({ name: "app" });

    expect(pkg["type"]).toBe("module");
    const deps = pkg["dependencies"] as Record<string, string>;
    expect(deps["@qawolf/flows"]).toBe(flowsVersion);
    const scripts = pkg["scripts"] as Record<string, string>;
    expect(scripts["test:e2e"]).toBe("qawolf flows run");
  });

  it('flips an explicit "type": "commonjs" and warns about the change', async () => {
    // Current npm writes "type": "commonjs" into every `npm init -y`
    // package.json, so an explicit value does not signal author intent.
    const { pkg, messages } = await initWithPkg({
      name: "app",
      type: "commonjs",
    });

    expect(pkg["type"]).toBe("module");
    expect(
      messages.some(
        (m) =>
          m.method === "warn" &&
          m.text.includes('Changed "type" from "commonjs"'),
      ),
    ).toBe(true);
    const deps = pkg["dependencies"] as Record<string, string>;
    expect(deps["@qawolf/flows"]).toBe(flowsVersion);
    const scripts = pkg["scripts"] as Record<string, string>;
    expect(scripts["test:e2e"]).toBe("qawolf flows run");
  });

  it("does not warn about a type change when the field was absent", async () => {
    const { pkg, messages } = await initWithPkg({ name: "app" });

    expect(pkg["type"]).toBe("module");
    expect(
      messages.some(
        (m) => m.method === "warn" && m.text.includes('Changed "type"'),
      ),
    ).toBe(false);
  });

  it("leaves a fully configured package.json byte-identical", async () => {
    const configured = {
      name: "app",
      type: "module",
      dependencies: { "@qawolf/flows": "0.0.1" },
      scripts: { "test:e2e": "qawolf flows run" },
    };
    const { written, messages } = await initWithPkg(configured);

    expect(written).toBe(JSON.stringify(configured));
    expect(
      messages.some(
        (m) => m.method === "info" && m.text.includes("already configured"),
      ),
    ).toBe(true);
  });

  it("does not add the dependency when @qawolf/flows is in devDependencies", async () => {
    const { pkg } = await initWithPkg({
      name: "app",
      type: "module",
      devDependencies: { "@qawolf/flows": "0.0.1" },
    });

    expect(pkg["dependencies"]).toBeUndefined();
    const devDeps = pkg["devDependencies"] as Record<string, string>;
    expect(devDeps["@qawolf/flows"]).toBe("0.0.1");
  });

  it("repairs type and dependency on re-run even when test:e2e already exists", async () => {
    // The old code returned early on an existing test:e2e script, so a
    // half-configured project could never be repaired by running init again.
    const { pkg, messages } = await initWithPkg({
      name: "app",
      scripts: { "test:e2e": "custom runner" },
    });

    expect(pkg["type"]).toBe("module");
    const deps = pkg["dependencies"] as Record<string, string>;
    expect(deps["@qawolf/flows"]).toBe(flowsVersion);
    const scripts = pkg["scripts"] as Record<string, string>;
    expect(scripts["test:e2e"]).toBe("custom runner");
    expect(
      messages.some((m) => m.method === "warn" && m.text.includes("test:e2e")),
    ).toBe(true);
  });
});
