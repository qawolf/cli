import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import type { CommandContext } from "~/shell/commandContext.js";
import { handleInit } from "./init.js";
import { flowsVersion } from "~/generated/dependencyVersions.js";
import { exampleFlowTs, qawolfConfigTs, qawolfGitignore } from "./templates.js";

const cwd = "/test/project";

function makeCtx(confirmValue = true) {
  const messages: { method: string; text: string }[] = [];
  const ctx = {
    ui: {
      gap: () => {},
      intro: () => {},
      step: (m: string) => messages.push({ method: "step", text: m }),
      info: (m: string) => messages.push({ method: "info", text: m }),
      warn: (m: string) => messages.push({ method: "warn", text: m }),
      outro: () => {},
      confirm: async (_msg: string, opts?: { yes?: boolean }) => {
        if (opts?.yes) return { ok: true, value: true };
        return { ok: true, value: confirmValue };
      },
    },
  } as unknown as CommandContext;
  return { ctx, messages };
}

describe("handleInit", () => {
  it("should create all four artifacts in an empty directory", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir(cwd, { recursive: true });
    const { ctx } = makeCtx();
    await memFs.writeFile(
      join(cwd, "package.json"),
      JSON.stringify({ name: "app" }),
    );

    await handleInit(ctx, { yes: false }, { cwd, fs: memFs });

    expect(await memFs.readFile(join(cwd, "qawolf.config.ts"))).toBe(
      qawolfConfigTs,
    );
    expect(
      await memFs.readFile(join(cwd, "src", "flows", "example.flow.ts")),
    ).toBe(exampleFlowTs);
    const gitignore = await memFs.readFile(join(cwd, ".qawolf", ".gitignore"));
    expect(gitignore).toBe(qawolfGitignore);
    const pkg = JSON.parse(
      await memFs.readFile(join(cwd, "package.json")),
    ) as Record<string, unknown>;
    const scripts = pkg["scripts"] as Record<string, string>;
    expect(scripts["test:e2e"]).toBe("qawolf flows run");
  });

  it("should skip qawolf.config.ts when it exists and confirm returns false", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir(cwd, { recursive: true });
    const { ctx, messages } = makeCtx(false);
    await memFs.writeFile(join(cwd, "qawolf.config.ts"), "// existing");

    await handleInit(ctx, { yes: false }, { cwd, fs: memFs });

    expect(await memFs.readFile(join(cwd, "qawolf.config.ts"))).toBe(
      "// existing",
    );
    expect(
      messages.some(
        (m) => m.method === "info" && m.text.includes("qawolf.config.ts"),
      ),
    ).toBe(true);
  });

  it("should overwrite qawolf.config.ts when --yes is set", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir(cwd, { recursive: true });
    const { ctx } = makeCtx(false);
    await memFs.writeFile(join(cwd, "qawolf.config.ts"), "// existing");

    await handleInit(ctx, { yes: true }, { cwd, fs: memFs });

    expect(await memFs.readFile(join(cwd, "qawolf.config.ts"))).toBe(
      qawolfConfigTs,
    );
  });

  it("should warn and skip test:e2e when already in package.json scripts", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir(cwd, { recursive: true });
    const { ctx, messages } = makeCtx();
    await memFs.writeFile(
      join(cwd, "package.json"),
      JSON.stringify({ scripts: { "test:e2e": "already there" } }),
    );

    await handleInit(ctx, { yes: false }, { cwd, fs: memFs });

    const pkg = JSON.parse(
      await memFs.readFile(join(cwd, "package.json")),
    ) as Record<string, unknown>;
    const scripts = pkg["scripts"] as Record<string, string>;
    expect(scripts["test:e2e"]).toBe("already there");
    expect(
      messages.some((m) => m.method === "warn" && m.text.includes("test:e2e")),
    ).toBe(true);
  });

  it("should create package.json with type:module when none exists", async () => {
    const memFs = makeMemoryFs();
    const { ctx } = makeCtx(true);

    await handleInit(ctx, { yes: false }, { cwd, fs: memFs });

    const pkg = JSON.parse(
      await memFs.readFile(join(cwd, "package.json")),
    ) as Record<string, unknown>;
    expect(pkg["private"]).toBe(true);
    expect(pkg["type"]).toBe("module");
    const deps = pkg["dependencies"] as Record<string, string>;
    expect(deps["@qawolf/flows"]).toBe(flowsVersion);
    const scripts = pkg["scripts"] as Record<string, string>;
    expect(scripts["test:e2e"]).toBe("qawolf flows run");
  });

  it("should skip creating package.json when none exists and confirm returns false", async () => {
    const memFs = makeMemoryFs();
    const { ctx } = makeCtx(false);

    await handleInit(ctx, { yes: false }, { cwd, fs: memFs });

    expect(await memFs.pathExists(join(cwd, "package.json"))).toBe(false);
  });

  it("should create package.json when --yes is set and none exists", async () => {
    const memFs = makeMemoryFs();
    const { ctx } = makeCtx(false);

    await handleInit(ctx, { yes: true }, { cwd, fs: memFs });

    const pkg = JSON.parse(
      await memFs.readFile(join(cwd, "package.json")),
    ) as Record<string, unknown>;
    expect(pkg["private"]).toBe(true);
    expect(pkg["type"]).toBe("module");
    const deps = pkg["dependencies"] as Record<string, string>;
    expect(deps["@qawolf/flows"]).toBe(flowsVersion);
    const scripts = pkg["scripts"] as Record<string, string>;
    expect(scripts["test:e2e"]).toBe("qawolf flows run");
  });

  it("should skip package.json update when confirm returns false", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir(cwd, { recursive: true });
    const { ctx, messages } = makeCtx(false);
    await memFs.writeFile(
      join(cwd, "package.json"),
      JSON.stringify({ name: "app" }),
    );

    await handleInit(ctx, { yes: false }, { cwd, fs: memFs });

    const pkg = JSON.parse(
      await memFs.readFile(join(cwd, "package.json")),
    ) as Record<string, unknown>;
    expect(pkg["scripts"]).toBeUndefined();
    expect(
      messages.some(
        (m) => m.method === "info" && m.text.includes("package.json"),
      ),
    ).toBe(true);
  });

  it("should add test:e2e to package.json when --yes is set", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir(cwd, { recursive: true });
    const { ctx } = makeCtx(false);
    await memFs.writeFile(
      join(cwd, "package.json"),
      JSON.stringify({ name: "app" }),
    );

    await handleInit(ctx, { yes: true }, { cwd, fs: memFs });

    const pkg = JSON.parse(
      await memFs.readFile(join(cwd, "package.json")),
    ) as Record<string, unknown>;
    const scripts = pkg["scripts"] as Record<string, string>;
    expect(scripts["test:e2e"]).toBe("qawolf flows run");
  });

  it("should warn when package.json is not valid JSON", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir(cwd, { recursive: true });
    const { ctx, messages } = makeCtx();
    await memFs.writeFile(join(cwd, "package.json"), "not json {");

    await handleInit(ctx, { yes: false }, { cwd, fs: memFs });

    expect(await memFs.readFile(join(cwd, "package.json"))).toBe("not json {");
    expect(
      messages.some(
        (m) => m.method === "warn" && m.text.includes("not valid JSON"),
      ),
    ).toBe(true);
  });
});
