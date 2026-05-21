import { afterEach, describe, expect, it, mock } from "bun:test";

import type { LoadApiKeyResult } from "./types.js";
import { requireApiKey, resolveApiKey } from "./resolve.js";

afterEach(() => {
  mock.restore();
});

describe("resolveApiKey", () => {
  it("returns env var when QAWOLF_API_KEY is set", async () => {
    const mockLoadApiKey =
      mock<(configDir: string) => Promise<LoadApiKeyResult>>();

    const result = await resolveApiKey("/tmp/config", {
      loadApiKey: mockLoadApiKey,
      env: { QAWOLF_API_KEY: "qaw_test_key" },
    });

    expect(result).toEqual({ key: "qaw_test_key", source: "env" });
    expect(mockLoadApiKey).not.toHaveBeenCalled();
  });

  it("trims whitespace from env var", async () => {
    const mockLoadApiKey =
      mock<(configDir: string) => Promise<LoadApiKeyResult>>();

    const result = await resolveApiKey("/tmp/config", {
      loadApiKey: mockLoadApiKey,
      env: { QAWOLF_API_KEY: "  qaw_test_key  " },
    });

    expect(result).toEqual({ key: "qaw_test_key", source: "env" });
    expect(mockLoadApiKey).not.toHaveBeenCalled();
  });

  it("skips whitespace-only env var", async () => {
    const mockLoadApiKey = mock<
      (configDir: string) => Promise<LoadApiKeyResult>
    >().mockResolvedValue({ found: false });

    const result = await resolveApiKey("/tmp/config", {
      loadApiKey: mockLoadApiKey,
      env: { QAWOLF_API_KEY: "   " },
    });

    expect(result).toBeUndefined();
    expect(mockLoadApiKey).toHaveBeenCalledWith("/tmp/config");
  });

  it("returns stored key when env var is not set", async () => {
    const mockLoadApiKey = mock<
      (configDir: string) => Promise<LoadApiKeyResult>
    >().mockResolvedValue({
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
    const mockLoadApiKey = mock<
      (configDir: string) => Promise<LoadApiKeyResult>
    >().mockResolvedValue({ found: false });

    const result = await resolveApiKey("/tmp/config", {
      loadApiKey: mockLoadApiKey,
      env: {},
    });

    expect(result).toBeUndefined();
  });
});

describe("requireApiKey", () => {
  it("returns the resolved ApiKeyResult when a key exists", async () => {
    const mockLoad = mock<(configDir: string) => Promise<LoadApiKeyResult>>();

    const result = await requireApiKey("/tmp/config", {
      loadApiKey: mockLoad,
      env: { QAWOLF_API_KEY: "qaw_key" },
    });

    expect(result).toEqual({ key: "qaw_key", source: "env" });
  });

  it("throws the standard message when no key is found", async () => {
    const mockLoad = mock<
      (configDir: string) => Promise<LoadApiKeyResult>
    >().mockResolvedValue({ found: false });

    let caughtError: unknown;
    try {
      await requireApiKey("/tmp/config", {
        loadApiKey: mockLoad,
        env: {},
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe(
      "QAWOLF_API_KEY is not set. Set it in your environment, or run 'qawolf auth login'. See 'qawolf doctor'.",
    );
  });
});
