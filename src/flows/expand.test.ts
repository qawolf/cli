import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  expandPatterns,
  extractFlowMeta,
  peekFlowMeta,
  targetToBrowser,
} from "./expand";

describe("targetToBrowser", () => {
  it('should return "chromium" when target is "chromium"', () => {
    expect(targetToBrowser("chromium")).toBe("chromium");
  });

  it('should return "firefox" when target is "firefox"', () => {
    expect(targetToBrowser("firefox")).toBe("firefox");
  });

  it('should return "webkit" when target is "webkit"', () => {
    expect(targetToBrowser("webkit")).toBe("webkit");
  });

  it("should return undefined when target is not a known browser", () => {
    expect(targetToBrowser("electron")).toBeUndefined();
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
});

describe("peekFlowMeta", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "expand-peek-"));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true });
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
  });

  afterAll(async () => {
    await rm(mainTmpDir, { recursive: true });
    await rm(noQawolfTmpDir, { recursive: true });
  });

  it("should return all flow files when no patterns provided and no .qawolf dir", async () => {
    const result = await expandPatterns([], noQawolfTmpDir);
    expect(result).toContain(join(noQawolfTmpDir, "a.flow.ts"));
    expect(result).toContain(join(noQawolfTmpDir, "sub", "b.flow.ts"));
  });

  it("should return files from the single .qawolf env dir when no patterns provided", async () => {
    const result = await expandPatterns([], mainTmpDir);
    expect(result).toContain(
      join(mainTmpDir, ".qawolf", "staging", "c.flow.ts"),
    );
    expect(result).not.toContain(join(mainTmpDir, "a.flow.ts"));
  });

  it("should return matched files when explicit patterns provided", async () => {
    const result = await expandPatterns(["sub/*.flow.ts"], mainTmpDir);
    expect(result).toContain(join(mainTmpDir, "sub", "b.flow.ts"));
  });

  it("should return empty array when no files match", async () => {
    const result = await expandPatterns(["*.missing.ts"], mainTmpDir);
    expect(result).toEqual([]);
  });
});
