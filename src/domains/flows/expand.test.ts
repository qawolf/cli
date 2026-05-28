// oxlint-disable eslint/max-lines -- passing fs to expandPatterns added ~10 lines; splitting the test file would obscure the coverage story
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractFlowMeta, targetToBrowser } from "~/core/flowMeta.js";
import { makeDefaultFs } from "~/shell/fs.js";
import { expandPatterns, makePeekFlowMeta } from "./expand.js";

const defaultFs = makeDefaultFs();
const peekFlowMeta = makePeekFlowMeta(defaultFs);

describe("targetToBrowser", () => {
  it.each([
    ["Web - Chrome", "chromium"],
    ["Web - Chrome (GPU)", "chromium"],
    ["Web - Firefox", "firefox"],
    ["Web - Firefox (GPU)", "firefox"],
    ["Web - Safari", "webkit"],
    ["Web - Safari (GPU)", "webkit"],
  ] as const)("maps web preset %p to %p", (target, browser) => {
    expect(targetToBrowser(target)).toBe(browser);
  });

  it.each(["Basic", "Electron"])(
    "returns undefined for non-browser web target %p",
    (target) => {
      expect(targetToBrowser(target)).toBeUndefined();
    },
  );

  it.each(["Android - Pixel", "iOS - iPad"])(
    "returns undefined for non-web target %p",
    (target) => {
      expect(targetToBrowser(target)).toBeUndefined();
    },
  );

  it("returns undefined for an unrecognised target string", () => {
    expect(targetToBrowser("not-a-real-target")).toBeUndefined();
  });
});

describe("extractFlowMeta", () => {
  it("should extract name and target from positional flow() call", () => {
    expect(
      extractFlowMeta('flow("My Flow", "chromium", async () => {})'),
    ).toEqual({ name: "My Flow", target: "chromium" });
  });

  it("should extract name and target from object-arg flow() call", () => {
    expect(
      extractFlowMeta(
        'flow("My Flow", { target: "webkit", launch: true }, async () => {})',
      ),
    ).toEqual({ name: "My Flow", target: "webkit" });
  });

  it("should extract name only when no target is present", () => {
    expect(extractFlowMeta('flow("My Flow", async () => {})')).toEqual({
      name: "My Flow",
      target: undefined,
    });
  });

  it("should return empty object when source has no flow() call", () => {
    expect(extractFlowMeta("export default async () => {}")).toEqual({
      name: undefined,
      target: undefined,
    });
  });

  it("should not extract target from a property outside the flow() call", () => {
    expect(
      extractFlowMeta(
        'const opts = { target: "production" }; flow("My Flow", async () => {})',
      ),
    ).toEqual({ name: "My Flow", target: undefined });
  });

  it("should extract name and target from a multi-line positional flow() call", () => {
    expect(
      extractFlowMeta(
        'flow(\n  "My Flow",\n  "chromium",\n  async () => {}\n)',
      ),
    ).toEqual({ name: "My Flow", target: "chromium" });
  });

  it("should extract name and target from a multi-line object-arg flow() call", () => {
    expect(
      extractFlowMeta(
        'flow(\n  "My Flow",\n  { target: "webkit", launch: true },\n  async () => {}\n)',
      ),
    ).toEqual({ name: "My Flow", target: "webkit" });
  });

  it("should extract target when the options object spans multiple lines", () => {
    expect(
      extractFlowMeta(
        'flow(\n  "My Flow",\n  {\n    target: "firefox",\n    launch: true,\n  },\n  async () => {}\n)',
      ),
    ).toEqual({ name: "My Flow", target: "firefox" });
  });

  it("should not match flow() calls on identifiers like workflow() or myflow()", () => {
    expect(
      extractFlowMeta('workflow("My Flow", "chromium", async () => {})'),
    ).toEqual({ name: undefined, target: undefined });
    expect(extractFlowMeta('myflow("My Flow", async () => {})')).toEqual({
      name: undefined,
      target: undefined,
    });
  });
});

describe("peekFlowMeta", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "expand-peek-"));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("should return parsed meta when file contains a flow() call", async () => {
    const filePath = join(tmpDir, "login.flow.ts");
    await writeFile(filePath, 'flow("Login", "firefox", async () => {})');
    expect(await peekFlowMeta(filePath)).toEqual({
      name: "Login",
      target: "firefox",
    });
  });

  it("should return empty meta when file has no flow() call", async () => {
    const filePath = join(tmpDir, "plain.ts");
    await writeFile(filePath, "export default async () => {}");
    expect(await peekFlowMeta(filePath)).toEqual({
      name: undefined,
      target: undefined,
    });
  });
});

describe("expandPatterns", () => {
  let mainTmpDir: string;
  let noQawolfTmpDir: string;
  let multiEnvTmpDir: string;

  beforeAll(async () => {
    mainTmpDir = await mkdtemp(join(tmpdir(), "expand-main-"));
    await writeFile(join(mainTmpDir, "a.flow.ts"), "// a");
    await mkdir(join(mainTmpDir, "sub"));
    await writeFile(join(mainTmpDir, "sub", "b.flow.ts"), "// b");
    await mkdir(join(mainTmpDir, ".qawolf", "staging"), { recursive: true });
    await writeFile(
      join(mainTmpDir, ".qawolf", "staging", "c.flow.ts"),
      "// c",
    );

    noQawolfTmpDir = await mkdtemp(join(tmpdir(), "expand-noquawolf-"));
    await writeFile(join(noQawolfTmpDir, "a.flow.ts"), "// a");
    await mkdir(join(noQawolfTmpDir, "sub"));
    await writeFile(join(noQawolfTmpDir, "sub", "b.flow.ts"), "// b");

    multiEnvTmpDir = await mkdtemp(join(tmpdir(), "expand-multienv-"));
    await writeFile(join(multiEnvTmpDir, "a.flow.ts"), "// a");
    await mkdir(join(multiEnvTmpDir, ".qawolf", "staging"), {
      recursive: true,
    });
    await writeFile(
      join(multiEnvTmpDir, ".qawolf", "staging", "s.flow.ts"),
      "// s",
    );
    await mkdir(join(multiEnvTmpDir, ".qawolf", "prod"), { recursive: true });
    await writeFile(
      join(multiEnvTmpDir, ".qawolf", "prod", "p.flow.ts"),
      "// p",
    );
  });

  afterAll(async () => {
    await rm(mainTmpDir, { recursive: true, force: true });
    await rm(noQawolfTmpDir, { recursive: true, force: true });
    await rm(multiEnvTmpDir, { recursive: true, force: true });
  });

  it("should return all flow files when no patterns provided and no .qawolf dir", async () => {
    const result = await expandPatterns(
      [],
      noQawolfTmpDir,
      undefined,
      defaultFs,
    );
    expect(result).toContain(join(noQawolfTmpDir, "a.flow.ts"));
    expect(result).toContain(join(noQawolfTmpDir, "sub", "b.flow.ts"));
  });

  it("should return files from the .qawolf env dir alongside cwd flows when no patterns provided", async () => {
    const result = await expandPatterns([], mainTmpDir, undefined, defaultFs);
    expect(result).toContain(
      join(mainTmpDir, ".qawolf", "staging", "c.flow.ts"),
    );
    expect(result).toContain(join(mainTmpDir, "a.flow.ts"));
    expect(result).toContain(join(mainTmpDir, "sub", "b.flow.ts"));
  });

  it("should resolve a pattern relative to each env dir root", async () => {
    const result = await expandPatterns(
      ["*.flow.ts"],
      mainTmpDir,
      undefined,
      defaultFs,
    );
    expect(result).toContain(
      join(mainTmpDir, ".qawolf", "staging", "c.flow.ts"),
    );
    expect(result).toContain(join(mainTmpDir, "a.flow.ts"));
  });

  it("should return empty array when no files match", async () => {
    const result = await expandPatterns(
      ["*.missing.ts"],
      mainTmpDir,
      undefined,
      defaultFs,
    );
    expect(result).toEqual([]);
  });

  it("should glob across all .qawolf env dirs when there are multiple", async () => {
    const result = await expandPatterns(
      [],
      multiEnvTmpDir,
      undefined,
      defaultFs,
    );
    expect(result).toContain(
      join(multiEnvTmpDir, ".qawolf", "staging", "s.flow.ts"),
    );
    expect(result).toContain(
      join(multiEnvTmpDir, ".qawolf", "prod", "p.flow.ts"),
    );
    expect(result).toContain(join(multiEnvTmpDir, "a.flow.ts"));
  });

  it("should discover .flow.js files alongside .flow.ts with the default pattern", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "expand-jsmix-"));
    await writeFile(join(tmp, "a.flow.ts"), "// a");
    await writeFile(join(tmp, "b.flow.js"), "// b");
    try {
      const result = await expandPatterns([], tmp, undefined, defaultFs);
      expect(result).toContain(join(tmp, "a.flow.ts"));
      expect(result).toContain(join(tmp, "b.flow.js"));
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
