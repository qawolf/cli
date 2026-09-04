import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { Entry } from "@napi-rs/keyring";

import type { StoredSession } from "~/domains/auth/types.js";
import type { Fs } from "~/shell/fs.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { deleteTokens } from "./deleteTokens.js";
import { loadTokens } from "./loadTokens.js";
import { saveTokens } from "./saveTokens.js";

afterEach(() => {
  mock.restore();
});

const tokens: StoredSession = {
  accessToken: "access_abc",
  refreshToken: "refresh_abc",
  expiresAt: 1_700_000_000_000,
  email: "person@example.com",
  organizationId: "org_1",
  clientId: "client_1",
};

function makeEntryClass(getPassword: () => string): typeof Entry {
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

describe("saveTokens", () => {
  it("stores tokens in the keychain when it is available", async () => {
    spyOn(Entry.prototype, "setPassword").mockReturnValue(undefined);
    const memFs = makeMemoryFs();
    await memFs.mkdir("/config", { recursive: true });

    const result = await saveTokens("/config", tokens, memFs);

    expect(result.stored).toBe("keychain");
    expect(await memFs.pathExists("/config/tokens.json")).toBe(false);
  });

  it("falls back to a token file when the keychain throws", async () => {
    spyOn(Entry.prototype, "setPassword").mockImplementation(() => {
      throw Error("keychain unavailable");
    });
    const memFs = makeMemoryFs();
    await memFs.mkdir("/config", { recursive: true });

    const result = await saveTokens("/config", tokens, memFs);

    expect(result.stored).toBe("file");
    const contents = await memFs.readFile("/config/tokens.json");
    expect(JSON.parse(contents)).toEqual(tokens);
  });

  it("writes the token file so only its owner can read it", async () => {
    spyOn(Entry.prototype, "setPassword").mockImplementation(() => {
      throw Error("keychain unavailable");
    });
    const memFs = makeMemoryFs();
    await memFs.mkdir("/config", { recursive: true });
    const modes: (number | undefined)[] = [];
    const recordingFs: Fs = {
      ...memFs,
      writeFile: (path, data, options) => {
        modes.push(options?.mode);
        return memFs.writeFile(path, data, options);
      },
    };

    await saveTokens("/config", tokens, recordingFs);

    expect(modes).toEqual([0o600]);
  });
});

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
});

describe("deleteTokens", () => {
  it("removes the token file", async () => {
    spyOn(Entry.prototype, "deletePassword").mockReturnValue(true);
    const memFs = makeMemoryFs();
    await memFs.mkdir("/config", { recursive: true });
    await memFs.writeFile("/config/tokens.json", JSON.stringify(tokens));

    const result = await deleteTokens("/config", memFs);

    expect(result.file).toBe("deleted");
    expect(await memFs.pathExists("/config/tokens.json")).toBe(false);
  });

  it("reports not-found when there is no token file", async () => {
    spyOn(Entry.prototype, "deletePassword").mockReturnValue(true);
    const memFs = makeMemoryFs();
    await memFs.mkdir("/config", { recursive: true });

    const result = await deleteTokens("/config", memFs);

    expect(result.file).toBe("not-found");
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
  // Reporting "Credentials removed" over a file that is still there is worse
  // than failing loudly.
  it("propagates a deletion failure that is not a missing file", async () => {
    spyOn(Entry.prototype, "deletePassword").mockReturnValue(true);
    const failing = {
      unlink: async () => {
        throw Object.assign(Error("permission denied"), { code: "EACCES" });
      },
    } as unknown as Fs;

    let caught: unknown;
    try {
      await deleteTokens("/config", failing);
    } catch (err) {
      caught = err;
    }

    expect((caught as Error | undefined)?.message).toBe("permission denied");
  });
});
