import { afterEach, describe, expect, it, mock } from "bun:test";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import type { OauthToken } from "./resolveOauthToken.js";
import type { LoadApiKeyResult } from "./types.js";
import { requireApiKey, resolveApiKey } from "./resolve.js";

afterEach(() => {
  mock.restore();
});

const memFs = makeMemoryFs();

/** Browser sign-in holds nothing, so only the API key paths are exercised. */
const noOauth = async (): Promise<OauthToken | undefined> => undefined;

function mockLoad(result?: LoadApiKeyResult) {
  const fn = mock<(configDir: string) => Promise<LoadApiKeyResult>>();
  if (result) fn.mockResolvedValue(result);
  return fn;
}

describe("resolveApiKey", () => {
  it("returns env var when QAWOLF_API_KEY is set", async () => {
    const loadApiKey = mockLoad();

    const result = await resolveApiKey("/tmp/config", memFs, {
      loadApiKey,
      resolveOauth: noOauth,
      env: { QAWOLF_API_KEY: "qaw_test_key" },
    });

    expect(result).toEqual({
      key: "qaw_test_key",
      source: "env",
    });
    expect(loadApiKey).not.toHaveBeenCalled();
  });

  it("trims whitespace from env var", async () => {
    const loadApiKey = mockLoad();

    const result = await resolveApiKey("/tmp/config", memFs, {
      loadApiKey,
      resolveOauth: noOauth,
      env: { QAWOLF_API_KEY: "  qaw_test_key  " },
    });

    expect(result).toEqual({
      key: "qaw_test_key",
      source: "env",
    });
    expect(loadApiKey).not.toHaveBeenCalled();
  });

  it("skips whitespace-only env var", async () => {
    const loadApiKey = mockLoad({ found: false });

    const result = await resolveApiKey("/tmp/config", memFs, {
      loadApiKey,
      resolveOauth: noOauth,
      env: { QAWOLF_API_KEY: "   " },
    });

    expect(result).toBeUndefined();
    expect(loadApiKey).toHaveBeenCalledWith("/tmp/config");
  });

  it("returns stored key when env var is not set", async () => {
    const result = await resolveApiKey("/tmp/config", memFs, {
      loadApiKey: mockLoad({
        found: true,
        key: "qaw_stored",
        source: "keychain",
      }),
      resolveOauth: noOauth,
      env: {},
    });

    expect(result).toEqual({
      key: "qaw_stored",
      source: "keychain",
    });
  });

  it("returns undefined when nothing found", async () => {
    const result = await resolveApiKey("/tmp/config", memFs, {
      loadApiKey: mockLoad({ found: false }),
      resolveOauth: noOauth,
      env: {},
    });

    expect(result).toBeUndefined();
  });

  it("falls back to browser sign-in when no API key is stored", async () => {
    const result = await resolveApiKey("/tmp/config", memFs, {
      loadApiKey: mockLoad({ found: false }),
      resolveOauth: async () => ({
        key: "access_abc",
        email: "person@example.com",
      }),
      env: {},
    });

    expect(result).toEqual({
      key: "access_abc",
      source: "browser",
    });
  });

  it("prefers a stored API key over browser sign-in for its team scope", async () => {
    const resolveOauth = mock(async () => ({
      key: "access_abc",
      email: "person@example.com",
    }));

    const result = await resolveApiKey("/tmp/config", memFs, {
      loadApiKey: mockLoad({
        found: true,
        key: "qaw_stored",
        source: "keychain",
      }),
      resolveOauth,
      env: {},
    });

    expect(result).toEqual({
      key: "qaw_stored",
      source: "keychain",
    });
    expect(resolveOauth).not.toHaveBeenCalled();
  });

  it("prefers the environment variable over browser sign-in", async () => {
    const resolveOauth = mock(async () => ({
      key: "access_abc",
      email: "person@example.com",
    }));

    const result = await resolveApiKey("/tmp/config", memFs, {
      loadApiKey: mockLoad(),
      resolveOauth,
      env: { QAWOLF_API_KEY: "qaw_env" },
    });

    expect(result).toEqual({
      key: "qaw_env",
      source: "env",
    });
    expect(resolveOauth).not.toHaveBeenCalled();
  });
});

describe("requireApiKey", () => {
  it("returns the resolved ApiKeyResult when a key exists", async () => {
    const result = await requireApiKey("/tmp/config", memFs, {
      loadApiKey: mockLoad(),
      resolveOauth: noOauth,
      env: { QAWOLF_API_KEY: "qaw_key" },
    });

    expect(result).toEqual({
      key: "qaw_key",
      source: "env",
    });
  });

  it("throws the standard message when no key is found", async () => {
    let caughtError: unknown;
    try {
      await requireApiKey("/tmp/config", memFs, {
        loadApiKey: mockLoad({ found: false }),
        resolveOauth: noOauth,
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
