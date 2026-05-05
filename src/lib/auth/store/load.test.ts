import { describe, expect, it, vi } from "vitest";

import type { Entry } from "@napi-rs/keyring";

import { loadApiKey } from "./load.js";

function makeEntryClass(getPassword: () => string | null): typeof Entry {
  return class {
    getPassword = getPassword;
  } as unknown as typeof Entry;
}

function makeThrowingEntryClass(message: string): typeof Entry {
  return class {
    constructor(_service: string, _account: string) {
      throw Error(message);
    }
    getPassword(): string {
      throw Error("unreachable");
    }
  } as unknown as typeof Entry;
}

describe("loadApiKey", () => {
  it("returns key from keychain when available", async () => {
    const EntryClass = makeEntryClass(() => "qaw_keychain_key");
    const readFile = vi.fn<(p: string, e: BufferEncoding) => Promise<string>>();

    const result = await loadApiKey("/tmp/config", { EntryClass, readFile });

    expect(result).toEqual({
      found: true,
      key: "qaw_keychain_key",
      source: "keychain",
    });
    expect(readFile).not.toHaveBeenCalled();
  });

  it("falls back to file when keychain throws", async () => {
    const EntryClass = makeThrowingEntryClass("keychain unavailable");
    const readFile = vi
      .fn<(p: string, e: BufferEncoding) => Promise<string>>()
      .mockResolvedValue(JSON.stringify({ apiKey: "qaw_file_key" }));

    const result = await loadApiKey("/tmp/config", { EntryClass, readFile });

    expect(result).toEqual({
      found: true,
      key: "qaw_file_key",
      source: "file",
    });
  });

  it("falls through to file when keychain returns empty string", async () => {
    const EntryClass = makeEntryClass(() => "");
    const readFile = vi
      .fn<(p: string, e: BufferEncoding) => Promise<string>>()
      .mockResolvedValue(JSON.stringify({ apiKey: "qaw_file_key" }));

    const result = await loadApiKey("/tmp/config", { EntryClass, readFile });

    expect(result).toEqual({
      found: true,
      key: "qaw_file_key",
      source: "file",
    });
  });

  it("returns found: false with errors from both keychain and file when both fail", async () => {
    const EntryClass = makeThrowingEntryClass("keychain locked");
    const readFile = vi
      .fn<(p: string, e: BufferEncoding) => Promise<string>>()
      .mockRejectedValue(Error("ENOENT: no such file or directory"));

    const result = await loadApiKey("/tmp/config", { EntryClass, readFile });

    expect(result).toEqual({
      found: false,
      errors: {
        keychain: "keychain locked",
        file: "ENOENT: no such file or directory",
      },
    });
  });

  it("returns found: false with file error when schema validation fails", async () => {
    const EntryClass = makeEntryClass(() => "");
    const readFile = vi
      .fn<(p: string, e: BufferEncoding) => Promise<string>>()
      .mockResolvedValue(JSON.stringify({ wrongField: "bad-data" }));

    const result = await loadApiKey("/tmp/config", { EntryClass, readFile });

    expect(result).toEqual({
      found: false,
      errors: {
        file: "Invalid credentials file format",
      },
    });
  });
});
