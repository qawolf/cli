import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@napi-rs/keyring", () => ({
  Entry: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

import type { Mock } from "vitest";
import { Entry } from "@napi-rs/keyring";
import { readFile } from "node:fs/promises";

import { loadApiKey } from "./load.js";

const MockEntry = vi.mocked(Entry);
const mockReadFile = readFile as unknown as Mock<
  (...args: unknown[]) => Promise<string>
>;

function makeEntryMock(getPassword: () => string | null): void {
  MockEntry.mockImplementation(function () {
    return { getPassword } as unknown as InstanceType<typeof Entry>;
  });
}

function makeEntryThrow(message: string): void {
  MockEntry.mockImplementation(function () {
    throw new Error(message);
  });
}

describe("loadApiKey", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns key from keychain when available", async () => {
    makeEntryMock(() => "qaw_keychain_key");

    const result = await loadApiKey("/tmp/config");

    expect(result).toEqual({
      found: true,
      key: "qaw_keychain_key",
      source: "keychain",
    });
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("falls back to file when keychain throws", async () => {
    makeEntryThrow("keychain unavailable");
    const fileContent = JSON.stringify({ apiKey: "qaw_file_key" });
    mockReadFile.mockResolvedValue(fileContent);

    const result = await loadApiKey("/tmp/config");

    expect(result).toEqual({
      found: true,
      key: "qaw_file_key",
      source: "file",
    });
  });

  it("returns file source with valid JSON credentials file", async () => {
    makeEntryMock(() => "");
    const fileContent = JSON.stringify({ apiKey: "qaw_file_key" });
    mockReadFile.mockResolvedValue(fileContent);

    const result = await loadApiKey("/tmp/config");

    expect(result).toEqual({
      found: true,
      key: "qaw_file_key",
      source: "file",
    });
  });

  it("returns found: false with errors from both keychain and file when both fail", async () => {
    makeEntryThrow("keychain locked");
    mockReadFile.mockRejectedValue(
      new Error("ENOENT: no such file or directory"),
    );

    const result = await loadApiKey("/tmp/config");

    expect(result).toEqual({
      found: false,
      errors: {
        keychain: "keychain locked",
        file: "ENOENT: no such file or directory",
      },
    });
  });

  it("returns found: false with file error when schema validation fails", async () => {
    makeEntryMock(() => "");
    const fileContent = JSON.stringify({ wrongField: "bad-data" });
    mockReadFile.mockResolvedValue(fileContent);

    const result = await loadApiKey("/tmp/config");

    expect(result).toEqual({
      found: false,
      errors: {
        file: "Invalid credentials file format",
      },
    });
  });

  it("falls through to file when keychain returns empty string", async () => {
    makeEntryMock(() => "");
    const fileContent = JSON.stringify({ apiKey: "qaw_file_key" });
    mockReadFile.mockResolvedValue(fileContent);

    const result = await loadApiKey("/tmp/config");

    expect(result).toEqual({
      found: true,
      key: "qaw_file_key",
      source: "file",
    });
  });
});
