import { describe, expect, it } from "bun:test";

import type { StoredSession } from "~/domains/auth/types.js";
import type { Fs } from "~/shell/fs.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { loadTokens } from "./loadTokens.js";
import {
  makeEntryClass,
  makeThrowingEntryClass,
  tokens,
} from "./tokens.testUtils.js";

describe("loadTokens", () => {
  it("returns tokens held in the keychain", async () => {
    const EntryClass = makeEntryClass(() => JSON.stringify(tokens));

    const result = await loadTokens("/config", {
      EntryClass,
      fs: makeMemoryFs(),
    });

    expect(result).toEqual({ found: true, tokens, source: "keychain" });
  });

  it("falls back to the token file when the keychain throws", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir("/config", { recursive: true });
    await memFs.writeFile("/config/tokens.json", JSON.stringify(tokens));

    const result = await loadTokens("/config", {
      EntryClass: makeThrowingEntryClass("keychain locked"),
      fs: memFs,
    });

    expect(result).toEqual({ found: true, tokens, source: "file" });
  });

  it("round-trips the organization, so a refresh can pin it", async () => {
    const EntryClass = makeEntryClass(() => JSON.stringify(tokens));

    const result = await loadTokens("/config", {
      EntryClass,
      fs: makeMemoryFs(),
    });

    if (!result.found) throw Error("expected stored tokens");
    expect(result.tokens.organizationId).toBe("org_1");
  });

  it("round-trips tokens whose expiry is unknown", async () => {
    const withoutExpiry: StoredSession = { ...tokens, expiresAt: undefined };
    const EntryClass = makeEntryClass(() => JSON.stringify(withoutExpiry));

    const result = await loadTokens("/config", {
      EntryClass,
      fs: makeMemoryFs(),
    });

    expect(result).toEqual({
      found: true,
      tokens: withoutExpiry,
      source: "keychain",
    });
  });

  it("reports not found when neither store holds tokens", async () => {
    const result = await loadTokens("/config", {
      EntryClass: makeEntryClass(() => ""),
      fs: makeMemoryFs(),
    });

    expect(result.found).toBe(false);
  });

  it("reports not found when the stored payload fails validation", async () => {
    const EntryClass = makeEntryClass(() =>
      JSON.stringify({ accessToken: "only-this" }),
    );

    const result = await loadTokens("/config", {
      EntryClass,
      fs: makeMemoryFs(),
    });

    expect(result.found).toBe(false);
  });

  // The shape a truncated or half-flushed write actually leaves behind. The
  // parse throws out of parseTokens rather than returning, so this covers the
  // catch that keeps a corrupt store from crashing the command.
  it("reports a store holding bytes that are not JSON", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir("/config", { recursive: true });
    await memFs.writeFile("/config/tokens.json", '{"accessToken": "trunc');

    const result = await loadTokens("/config", {
      EntryClass: makeEntryClass(() => ""),
      fs: memFs as unknown as Fs,
    });

    expect(result.found).toBe(false);
    if (result.found) return;
    expect(result.errors?.file).toBeDefined();
  });

  it("reports a store holding JSON that is not a session", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir("/config", { recursive: true });
    await memFs.writeFile("/config/tokens.json", '{"nonsense": true}');

    const result = await loadTokens("/config", {
      EntryClass: makeEntryClass(() => ""),
      fs: memFs as unknown as Fs,
    });

    expect(result.found).toBe(false);
  });
});
