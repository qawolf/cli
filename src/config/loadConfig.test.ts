import { describe, expect, it } from "bun:test";

import { loadConfig, type LoadConfigDeps } from "./loadConfig.js";

const CWD = "/fake/cwd";
const CONFIG_PATH = "/fake/cwd/qawolf.config.ts";

function withConfig(value: unknown): LoadConfigDeps {
  return {
    cwd: () => CWD,
    importConfig: async (path) => {
      expect(path).toBe(CONFIG_PATH);
      return value === undefined ? undefined : { default: value };
    },
  };
}

function missingConfig(): LoadConfigDeps {
  return {
    cwd: () => CWD,
    importConfig: async () => undefined,
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
      /timeout: expected number, got string/,
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

  it("treats bun's ResolveMessage (not instanceof Error) as missing config", async () => {
    // Mirrors bun's real ResolveMessage: typeof "object", has `code`, NOT instanceof Error.
    class FakeResolveMessage {
      code = "ERR_MODULE_NOT_FOUND";
      message = "Cannot find module";
    }
    const config = await loadConfig({
      cwd: () => CWD,
      importConfig: async () => {
        // The whole point: bun throws a non-Error, and we must still handle it.
        // oxlint-disable-next-line typescript-eslint/only-throw-error
        throw new FakeResolveMessage();
      },
    });
    expect(config.outputDir).toBe(".qawolf");
  });

  it("propagates non-ENOENT import errors", async () => {
    const boom = new Error("syntax error in user config");
    expect(
      loadConfig({
        cwd: () => CWD,
        importConfig: async () => {
          throw boom;
        },
      }),
    ).rejects.toThrow("syntax error in user config");
  });
});
