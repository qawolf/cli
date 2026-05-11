import { describe, expect, it } from "bun:test";

import { loadConfig, type LoadConfigDeps } from "./loadConfig.js";

const cwd = "/fake/cwd";
const configPath = "/fake/cwd/qawolf.config.ts";

function withConfig(value: unknown): LoadConfigDeps {
  return {
    cwd: () => cwd,
    fileExists: () => true,
    importConfig: async (path) => {
      expect(path).toBe(configPath);
      return value === undefined ? undefined : { default: value };
    },
  };
}

function missingConfig(): LoadConfigDeps {
  return {
    cwd: () => cwd,
    fileExists: () => false,
    importConfig: async () => {
      throw new Error("importConfig should not be called when file is missing");
    },
  };
}

describe("loadConfig", () => {
  it("returns defaults when qawolf.config.ts is missing", async () => {
    const config = await loadConfig(missingConfig());
    expect(config).toEqual({
      outputDir: ".qawolf",
      timeout: 60_000,
      retries: 0,
      bail: false,
      workers: 1,
      video: "retain-on-failure",
      trace: "retain-on-failure",
      apiUrl: "https://app.qawolf.com",
    });
  });

  it("merges user values with defaults", async () => {
    const config = await loadConfig(
      withConfig({ outputDir: "out", retries: 2 }),
    );
    expect(config.outputDir).toBe("out");
    expect(config.retries).toBe(2);
    expect(config.timeout).toBe(60_000);
    expect(config.video).toBe("retain-on-failure");
  });

  it("accepts a fully-specified valid config", async () => {
    const input = {
      outputDir: "artifacts",
      timeout: 30_000,
      retries: 3,
      bail: true,
      workers: 1,
      video: "off",
      trace: "on",
      apiUrl: "https://staging.qawolf.com",
    } as const;
    const config = await loadConfig(withConfig(input));
    expect(config).toEqual(input);
  });

  it("rejects workers !== 1 with a message naming workers and the cap", async () => {
    expect(loadConfig(withConfig({ workers: 4 }))).rejects.toThrow(
      /workers: must be 1 \(got 4\)/,
    );
  });

  it("rejects timeout: '60s' with a message naming timeout and expecting number", async () => {
    expect(loadConfig(withConfig({ timeout: "60s" }))).rejects.toThrow(
      /timeout: expected number, got "60s"/,
    );
  });

  it("falls back to a type label when the offending value is an object", async () => {
    expect(
      loadConfig(withConfig({ outputDir: { nested: "x" } })),
    ).rejects.toThrow(/outputDir: expected string, got object/);
  });

  it("truncates long string values in error messages", async () => {
    const long = "a".repeat(200);
    expect(loadConfig(withConfig({ timeout: long }))).rejects.toThrow(
      /timeout: expected number, got "a{60}\.\.\."/,
    );
  });

  it("rejects negative retries", async () => {
    expect(loadConfig(withConfig({ retries: -1 }))).rejects.toThrow(/retries/);
  });

  it("rejects non-integer timeout", async () => {
    expect(loadConfig(withConfig({ timeout: 1.5 }))).rejects.toThrow(/timeout/);
  });

  it("rejects unrecognized keys (typos)", async () => {
    expect(loadConfig(withConfig({ outpuDir: ".qawolf" }))).rejects.toThrow(
      /unknown key\(s\): outpuDir/,
    );
  });

  it("rejects invalid video enum with allowed values listed", async () => {
    expect(loadConfig(withConfig({ video: "always" }))).rejects.toThrow(
      /video: must be "on" \| "off" \| "retain-on-failure"/,
    );
  });

  it("rejects an invalid apiUrl", async () => {
    expect(loadConfig(withConfig({ apiUrl: "not-a-url" }))).rejects.toThrow(
      /apiUrl/,
    );
  });

  it("prefixes the error message with the config filename", async () => {
    expect(loadConfig(withConfig({ workers: 2 }))).rejects.toThrow(
      /^Invalid qawolf\.config\.ts:/,
    );
  });

  it("propagates errors from importing a present-but-broken config", async () => {
    // Regression: previously isModuleNotFoundError swallowed ANY ERR_MODULE_NOT_FOUND,
    // so a config that exists but imports something missing was silently treated as
    // "config missing" and replaced with defaults. After gating on fileExists, the
    // error from inside the user's config must propagate.
    const innerImportError = Object.assign(
      new Error("Cannot find module './does-not-exist.js'"),
      { code: "ERR_MODULE_NOT_FOUND" },
    );
    expect(
      loadConfig({
        cwd: () => cwd,
        fileExists: () => true,
        importConfig: async () => {
          throw innerImportError;
        },
      }),
    ).rejects.toThrow("Cannot find module './does-not-exist.js'");
  });

  it("does not call importConfig when the file is missing", async () => {
    let importCalls = 0;
    await loadConfig({
      cwd: () => cwd,
      fileExists: () => false,
      importConfig: async () => {
        importCalls++;
        return undefined;
      },
    });
    expect(importCalls).toBe(0);
  });
});
