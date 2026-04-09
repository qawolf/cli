import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveApiKey } from "./resolve.js";

vi.mock("./store/index.js", () => ({
  loadApiKey: vi.fn(),
}));

import { loadApiKey } from "./store/index.js";

const mockLoadApiKey = vi.mocked(loadApiKey);

describe("resolveApiKey", () => {
  const originalEnv = process.env["QAWOLF_API_KEY"];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["QAWOLF_API_KEY"];
    } else {
      process.env["QAWOLF_API_KEY"] = originalEnv;
    }
    vi.resetAllMocks();
  });

  it("returns env var when QAWOLF_API_KEY is set", async () => {
    process.env["QAWOLF_API_KEY"] = "qaw_test_key";
    const result = await resolveApiKey("/tmp/config");
    expect(result).toEqual({ key: "qaw_test_key", source: "env" });
    expect(mockLoadApiKey).not.toHaveBeenCalled();
  });

  it("trims whitespace from env var", async () => {
    process.env["QAWOLF_API_KEY"] = "  qaw_test_key  ";
    const result = await resolveApiKey("/tmp/config");
    expect(result).toEqual({ key: "qaw_test_key", source: "env" });
  });

  it("skips empty env var", async () => {
    process.env["QAWOLF_API_KEY"] = "   ";
    mockLoadApiKey.mockResolvedValue({ found: false });
    const result = await resolveApiKey("/tmp/config");
    expect(result).toBeUndefined();
  });

  it("returns stored key when env var is not set", async () => {
    delete process.env["QAWOLF_API_KEY"];
    mockLoadApiKey.mockResolvedValue({
      found: true,
      key: "qaw_stored",
      source: "keychain",
    });
    const result = await resolveApiKey("/tmp/config");
    expect(result).toEqual({ key: "qaw_stored", source: "keychain" });
  });

  it("returns undefined when nothing found", async () => {
    delete process.env["QAWOLF_API_KEY"];
    mockLoadApiKey.mockResolvedValue({ found: false });
    const result = await resolveApiKey("/tmp/config");
    expect(result).toBeUndefined();
  });
});
