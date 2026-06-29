import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { join } from "node:path";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { shimFlowsDeps, type BuildFn } from "./shimDeps.js";

const envDir = "/project";
const flowsDir = join(envDir, "node_modules", "@qawolf", "flows");
const shimsDir = join(flowsDir, "node_modules");

const mockBuild = mock<BuildFn>();

function makeSuccessBuild(code = "module.exports = {};") {
  const blob = new Blob([code]);
  mockBuild.mockResolvedValue({ success: true, outputs: [blob], logs: [] });
}

function makeFlowsFs() {
  const fs = makeMemoryFs();
  void fs.mkdir(flowsDir, { recursive: true });
  void fs.writeFile(
    join(flowsDir, "package.json"),
    JSON.stringify({ dependencies: { expect: "29.0.0" } }),
  );
  const expectDir = join(envDir, "node_modules", "expect");
  void fs.mkdir(expectDir, { recursive: true });
  void fs.writeFile(
    join(expectDir, "package.json"),
    JSON.stringify({
      name: "expect",
      version: "29.0.0",
      exports: { ".": "./index.js" },
    }),
  );
  return fs;
}

beforeEach(() => {
  mockBuild.mockClear();
});

afterEach(() => {
  mock.restore();
});

describe("shimFlowsDeps (Bun mode)", () => {
  it("creates a shim when none exists", async () => {
    const fs = makeFlowsFs();
    makeSuccessBuild("module.exports = { expect: true };");

    await shimFlowsDeps(envDir, fs, mockBuild);

    const shimPkg = JSON.parse(
      await fs.readFile(join(shimsDir, "expect", "package.json")),
    ) as { _qawolf_version: string; _qawolf_format: string };
    expect(shimPkg._qawolf_version).toBe("29.0.0");
    expect(shimPkg._qawolf_format).toBe("bun-build-v1");
    expect(await fs.readFile(join(shimsDir, "expect", "index.js"))).toContain(
      "module.exports",
    );
    expect(mockBuild).toHaveBeenCalledTimes(1);
  });

  it("skips shim creation when markers are up-to-date", async () => {
    const fs = makeFlowsFs();
    await fs.mkdir(join(shimsDir, "expect"), { recursive: true });
    await fs.writeFile(
      join(shimsDir, "expect", "package.json"),
      JSON.stringify({
        name: "expect",
        _qawolf_version: "29.0.0",
        _qawolf_format: "bun-build-v1",
      }),
    );

    await shimFlowsDeps(envDir, fs, mockBuild);

    expect(mockBuild).not.toHaveBeenCalled();
  });

  it("rebuilds shim when version is stale", async () => {
    const fs = makeFlowsFs();
    await fs.mkdir(join(shimsDir, "expect"), { recursive: true });
    await fs.writeFile(
      join(shimsDir, "expect", "package.json"),
      JSON.stringify({
        name: "expect",
        _qawolf_version: "28.0.0",
        _qawolf_format: "bun-build-v1",
      }),
    );
    makeSuccessBuild();

    await shimFlowsDeps(envDir, fs, mockBuild);

    expect(mockBuild).toHaveBeenCalledTimes(1);
    const shimPkg = JSON.parse(
      await fs.readFile(join(shimsDir, "expect", "package.json")),
    ) as { _qawolf_version: string };
    expect(shimPkg._qawolf_version).toBe("29.0.0");
  });

  it("skips shimDir that has no _qawolf_format marker (real package)", async () => {
    const fs = makeFlowsFs();
    // Simulate pnpm nested install: real package present, no marker
    await fs.mkdir(join(shimsDir, "expect"), { recursive: true });
    await fs.writeFile(
      join(shimsDir, "expect", "package.json"),
      JSON.stringify({ name: "expect", version: "29.0.0" }),
    );

    await shimFlowsDeps(envDir, fs, mockBuild);

    expect(mockBuild).not.toHaveBeenCalled();
    const pkgStr = await fs.readFile(join(shimsDir, "expect", "package.json"));
    expect(pkgStr).not.toContain("_qawolf_format");
  });

  it("skips dep when resolveFromEnvDir fails (no exports or main)", async () => {
    const fs = makeFlowsFs();
    // Remove the exports field so resolution fails
    const expectDir = join(envDir, "node_modules", "expect");
    await fs.writeFile(
      join(expectDir, "package.json"),
      JSON.stringify({ name: "expect", version: "29.0.0" }),
    );

    await shimFlowsDeps(envDir, fs, mockBuild);

    expect(mockBuild).not.toHaveBeenCalled();
  });

  it("throws when bun.build fails so the install aborts", async () => {
    const fs = makeFlowsFs();
    mockBuild.mockResolvedValue({
      success: false,
      outputs: [],
      logs: [{ message: "boom" }],
    });

    expect(shimFlowsDeps(envDir, fs, mockBuild)).rejects.toThrow(
      "bun.build failed to shim",
    );

    expect(mockBuild).toHaveBeenCalledTimes(1);
  });
});

describe("shimFlowsDeps (Node.js mode — no Bun)", () => {
  it("removes managed shims", async () => {
    const fs = makeFlowsFs();
    await fs.mkdir(join(shimsDir, "expect"), { recursive: true });
    await fs.writeFile(
      join(shimsDir, "expect", "package.json"),
      JSON.stringify({
        name: "expect",
        _qawolf_version: "29.0.0",
        _qawolf_format: "bun-build-v1",
      }),
    );
    await fs.writeFile(
      join(shimsDir, "expect", "index.js"),
      "module.exports={}",
    );

    await shimFlowsDeps(envDir, fs, false);

    expect(await fs.pathExists(join(shimsDir, "expect"))).toBe(false);
  });

  it("leaves real packages untouched when no marker present", async () => {
    const fs = makeFlowsFs();
    await fs.mkdir(join(shimsDir, "expect"), { recursive: true });
    await fs.writeFile(
      join(shimsDir, "expect", "package.json"),
      JSON.stringify({ name: "expect", version: "29.0.0" }),
    );

    await shimFlowsDeps(envDir, fs, false);

    expect(await fs.pathExists(join(shimsDir, "expect"))).toBe(true);
    const pkgStr = await fs.readFile(join(shimsDir, "expect", "package.json"));
    expect(pkgStr).toContain('"version"');
  });

  it("does nothing when shimsDir is absent", async () => {
    const fs = makeFlowsFs();

    await shimFlowsDeps(envDir, fs, false);
  });
});
