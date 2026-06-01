import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { Entry } from "@napi-rs/keyring";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { deleteApiKey } from "./delete.js";
import { saveApiKey } from "./save.js";

afterEach(() => {
  mock.restore();
});

describe("saveApiKey", () => {
  it("returns stored: keychain when keychain write succeeds", async () => {
    spyOn(Entry.prototype, "setPassword").mockReturnValue(undefined);
    const memFs = makeMemoryFs();
    await memFs.mkdir("/config", { recursive: true });

    const result = await saveApiKey("/config", "key-abc", memFs);

    expect(result.stored).toBe("keychain");
    expect(await memFs.pathExists("/config/credentials.json")).toBe(false);
  });

  it("falls back to credentials file when keychain throws", async () => {
    spyOn(Entry.prototype, "setPassword").mockImplementation(() => {
      throw new Error("keychain unavailable");
    });
    const memFs = makeMemoryFs();
    await memFs.mkdir("/config", { recursive: true });

    const result = await saveApiKey("/config", "key-abc", memFs);

    expect(result.stored).toBe("file");
    const contents = await memFs.readFile("/config/credentials.json");
    expect(contents).toContain("apiKey");
    expect(contents).toContain("key-abc");
  });
});

describe("deleteApiKey", () => {
  it("should delete credentials file via injected fs", async () => {
    spyOn(Entry.prototype, "deletePassword").mockReturnValue(true);
    const memFs = makeMemoryFs();
    await memFs.mkdir("/config", { recursive: true });
    await memFs.writeFile(
      "/config/credentials.json",
      JSON.stringify({ apiKey: "old" }),
    );

    const result = await deleteApiKey("/config", memFs);

    expect(result.file).toBe("deleted");
    expect(await memFs.pathExists("/config/credentials.json")).toBe(false);
  });

  it("should return not-found when credentials file does not exist", async () => {
    spyOn(Entry.prototype, "deletePassword").mockReturnValue(true);
    const memFs = makeMemoryFs();
    await memFs.mkdir("/config", { recursive: true });

    const result = await deleteApiKey("/config", memFs);

    expect(result.file).toBe("not-found");
  });
});
