import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  mkdir as fsMkdir,
  mkdtemp,
  readFile as fsReadFile,
  rm,
  writeFile as fsWriteFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathExists } from "~/shell/fs.js";
import type { CommandContext } from "~/shell/commandContext.js";
import { type InitDeps, handleInit } from "./init.js";
import { exampleFlowTs, qawolfConfigTs, qawolfGitignore } from "./templates.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "qawolf-init-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function makeDeps(cwd: string): InitDeps {
  return {
    cwd,
    pathExists,
    readFile: (p, enc) => fsReadFile(p, enc),
    writeFile: (p, content) => fsWriteFile(p, content),
    mkdir: async (p, opts) => {
      await fsMkdir(p, opts);
    },
  };
}

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
    const { ctx } = makeCtx();
    await fsWriteFile(
      join(dir, "package.json"),
      JSON.stringify({ name: "app" }),
    );

    await handleInit(ctx, { yes: false }, makeDeps(dir));

    expect(await fsReadFile(join(dir, "qawolf.config.ts"), "utf-8")).toBe(
      qawolfConfigTs,
    );
    expect(
      await fsReadFile(join(dir, "src", "flows", "example.flow.ts"), "utf-8"),
    ).toBe(exampleFlowTs);
    const gitignore = await fsReadFile(
      join(dir, ".qawolf", ".gitignore"),
      "utf-8",
    );
    expect(gitignore).toBe(qawolfGitignore);
    const pkg = JSON.parse(
      await fsReadFile(join(dir, "package.json"), "utf-8"),
    ) as Record<string, unknown>;
    const scripts = pkg["scripts"] as Record<string, string>;
    expect(scripts["test:e2e"]).toBe("qawolf flows run");
  });

  it("should skip qawolf.config.ts when it exists and confirm returns false", async () => {
    const { ctx, messages } = makeCtx(false);
    await fsWriteFile(join(dir, "qawolf.config.ts"), "// existing");

    await handleInit(ctx, { yes: false }, makeDeps(dir));

    expect(await fsReadFile(join(dir, "qawolf.config.ts"), "utf-8")).toBe(
      "// existing",
    );
    expect(
      messages.some(
        (m) => m.method === "info" && m.text.includes("qawolf.config.ts"),
      ),
    ).toBe(true);
  });

  it("should overwrite qawolf.config.ts when --yes is set", async () => {
    const { ctx } = makeCtx(false);
    await fsWriteFile(join(dir, "qawolf.config.ts"), "// existing");

    await handleInit(ctx, { yes: true }, makeDeps(dir));

    expect(await fsReadFile(join(dir, "qawolf.config.ts"), "utf-8")).toBe(
      qawolfConfigTs,
    );
  });

  it("should warn and skip test:e2e when already in package.json scripts", async () => {
    const { ctx, messages } = makeCtx();
    await fsWriteFile(
      join(dir, "package.json"),
      JSON.stringify({ scripts: { "test:e2e": "already there" } }),
    );

    await handleInit(ctx, { yes: false }, makeDeps(dir));

    const pkg = JSON.parse(
      await fsReadFile(join(dir, "package.json"), "utf-8"),
    ) as Record<string, unknown>;
    const scripts = pkg["scripts"] as Record<string, string>;
    expect(scripts["test:e2e"]).toBe("already there");
    expect(
      messages.some((m) => m.method === "warn" && m.text.includes("test:e2e")),
    ).toBe(true);
  });

  it("should create package.json with type:module when none exists", async () => {
    const { ctx } = makeCtx(true);

    await handleInit(ctx, { yes: false }, makeDeps(dir));

    const pkg = JSON.parse(
      await fsReadFile(join(dir, "package.json"), "utf-8"),
    ) as Record<string, unknown>;
    expect(pkg["type"]).toBe("module");
    const scripts = pkg["scripts"] as Record<string, string>;
    expect(scripts["test:e2e"]).toBe("qawolf flows run");
  });

  it("should skip creating package.json when none exists and confirm returns false", async () => {
    const { ctx } = makeCtx(false);

    await handleInit(ctx, { yes: false }, makeDeps(dir));

    expect(await pathExists(join(dir, "package.json"))).toBe(false);
  });

  it("should skip package.json update when confirm returns false", async () => {
    const { ctx, messages } = makeCtx(false);
    await fsWriteFile(
      join(dir, "package.json"),
      JSON.stringify({ name: "app" }),
    );

    await handleInit(ctx, { yes: false }, makeDeps(dir));

    const pkg = JSON.parse(
      await fsReadFile(join(dir, "package.json"), "utf-8"),
    ) as Record<string, unknown>;
    expect(pkg["scripts"]).toBeUndefined();
    expect(
      messages.some(
        (m) => m.method === "info" && m.text.includes("package.json"),
      ),
    ).toBe(true);
  });

  it("should add test:e2e to package.json when --yes is set", async () => {
    const { ctx } = makeCtx(false);
    await fsWriteFile(
      join(dir, "package.json"),
      JSON.stringify({ name: "app" }),
    );

    await handleInit(ctx, { yes: true }, makeDeps(dir));

    const pkg = JSON.parse(
      await fsReadFile(join(dir, "package.json"), "utf-8"),
    ) as Record<string, unknown>;
    const scripts = pkg["scripts"] as Record<string, string>;
    expect(scripts["test:e2e"]).toBe("qawolf flows run");
  });

  it("should warn when package.json is not valid JSON", async () => {
    const { ctx, messages } = makeCtx();
    await fsWriteFile(join(dir, "package.json"), "not json {");

    await handleInit(ctx, { yes: false }, makeDeps(dir));

    expect(await fsReadFile(join(dir, "package.json"), "utf-8")).toBe(
      "not json {",
    );
    expect(
      messages.some(
        (m) => m.method === "warn" && m.text.includes("not valid JSON"),
      ),
    ).toBe(true);
  });
});
