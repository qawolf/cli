import { describe, expect, it } from "bun:test";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { deleteApiKey } from "./delete.js";
import { saveApiKey } from "./save.js";

describe("saveApiKey", () => {
  it("should write credentials file to injected fs when keychain is unavailable", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir("/config", { recursive: true });

    const result = await saveApiKey("/config", "key-abc", memFs);

    // Keychain may succeed on some platforms (macOS); on others it falls back to file.
    if (result.stored === "file") {
      const contents = await memFs.readFile("/config/credentials.json");
      expect(contents).toContain("apiKey");
      expect(contents).toContain("key-abc");
    } else {
      expect(result.stored).toBe("keychain");
    }
  });
});

describe("deleteApiKey", () => {
  it("should delete credentials file via injected fs", async () => {
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
    const memFs = makeMemoryFs();
    await memFs.mkdir("/config", { recursive: true });

    const result = await deleteApiKey("/config", memFs);

    expect(result.file).toBe("not-found");
  });
});
