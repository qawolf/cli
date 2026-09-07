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

  it("round-trips the organization the token was granted for", async () => {
    const EntryClass = makeEntryClass(() => JSON.stringify(tokens));

    const result = await loadTokens("/config", {
      EntryClass,
      fs: makeMemoryFs(),
    });

    if (!result.found) throw Error("expected stored tokens");
    expect(result.tokens.organizationId).toBe("org_1");
  });

  // A refresh is only redeemable against its issuer and client, and only
  // yields a usable token when it asks for the same resource. All three ride
  // with the session so a later refresh asks the deployment nothing.
  it("round-trips the issuer, client and resource the session is bound to", async () => {
    const EntryClass = makeEntryClass(() => JSON.stringify(tokens));

    const result = await loadTokens("/config", {
      EntryClass,
      fs: makeMemoryFs(),
    });

    if (!result.found) throw Error("expected stored tokens");
    expect(result.tokens.issuer).toBe("https://signin.example");
    expect(result.tokens.clientId).toBe("client_1");
    expect(result.tokens.resource).toBe("https://app.example/api");
  });

  // A session from before Connect has no issuer or resource to refresh
  // against. Guessing them from the current deployment could bind a refresh to
  // the wrong place, so the record is treated as needing a fresh sign-in.
  it("does not load a session that predates Connect, and says why", async () => {
    const legacy = {
      accessToken: "access_abc",
      refreshToken: "refresh_abc",
      expiresAt: 1_700_000_000_000,
      email: "person@example.com",
      organizationId: "org_1",
      clientId: "client_1",
    };
    const EntryClass = makeEntryClass(() => JSON.stringify(legacy));

    const result = await loadTokens("/config", {
      EntryClass,
      fs: makeMemoryFs(),
    });

    expect(result.found).toBe(false);
    if (result.found) return;
    expect(result.errors?.keychain).toContain("sign in again");
  });

  it("treats a record with an issuer but no resource the same way", async () => {
    const partial = {
      accessToken: "access_abc",
      refreshToken: "refresh_abc",
      email: "person@example.com",
      issuer: "https://signin.example",
      clientId: "client_1",
    };
    const EntryClass = makeEntryClass(() => JSON.stringify(partial));

    const result = await loadTokens("/config", {
      EntryClass,
      fs: makeMemoryFs(),
    });

    expect(result.found).toBe(false);
    if (result.found) return;
    expect(result.errors?.keychain).toContain("sign in again");
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
