import { describe, expect, it, vi } from "vitest";

import type { LoadApiKeyResult } from "./types.js";
import { resolveApiKey } from "./resolve.js";

describe("resolveApiKey", () => {
  it("returns env var when QAWOLF_API_KEY is set", async () => {
    const mockLoadApiKey =
      vi.fn<(configDir: string) => Promise<LoadApiKeyResult>>();

    const result = await resolveApiKey("/tmp/config", {
      loadApiKey: mockLoadApiKey,
      env: { QAWOLF_API_KEY: "qaw_test_key" },
    });

    expect(result).toEqual({ key: "qaw_test_key", source: "env" });
    expect(mockLoadApiKey).not.toHaveBeenCalled();
  });

  it("trims whitespace from env var", async () => {
    const mockLoadApiKey =
      vi.fn<(configDir: string) => Promise<LoadApiKeyResult>>();

    const result = await resolveApiKey("/tmp/config", {
      loadApiKey: mockLoadApiKey,
      env: { QAWOLF_API_KEY: "  qaw_test_key  " },
    });

    expect(result).toEqual({ key: "qaw_test_key", source: "env" });
  });

  it("skips whitespace-only env var", async () => {
    const mockLoadApiKey = vi
      .fn<(configDir: string) => Promise<LoadApiKeyResult>>()
      .mockResolvedValue({ found: false });

    const result = await resolveApiKey("/tmp/config", {
      loadApiKey: mockLoadApiKey,
      env: { QAWOLF_API_KEY: "   " },
    });

    expect(result).toBeUndefined();
  });

  it("returns stored key when env var is not set", async () => {
    const mockLoadApiKey = vi
      .fn<(configDir: string) => Promise<LoadApiKeyResult>>()
      .mockResolvedValue({
        found: true,
        key: "qaw_stored",
        source: "keychain",
      });

    const result = await resolveApiKey("/tmp/config", {
      loadApiKey: mockLoadApiKey,
      env: {},
    });

    expect(result).toEqual({ key: "qaw_stored", source: "keychain" });
  });

  it("returns undefined when nothing found", async () => {
    const mockLoadApiKey = vi
      .fn<(configDir: string) => Promise<LoadApiKeyResult>>()
      .mockResolvedValue({ found: false });

    const result = await resolveApiKey("/tmp/config", {
      loadApiKey: mockLoadApiKey,
      env: {},
    });

    expect(result).toBeUndefined();
  });
});
