import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { Entry } from "@napi-rs/keyring";

import type { Fs } from "~/shell/fs.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { deleteTokens } from "./deleteTokens.js";
import { saveTokens } from "./saveTokens.js";
import { tokens } from "./tokens.testUtils.js";

afterEach(() => {
  mock.restore();
});

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
