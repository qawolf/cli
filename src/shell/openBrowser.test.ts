import { describe, expect, it, mock } from "bun:test";

import type { SpawnFn } from "./spawn.js";
import { openBrowser } from "./openBrowser.js";

function makeSpawn(exitCode = 0) {
  return mock<SpawnFn>(async () => ({ exitCode, stdout: "", stderr: "" }));
}

const url = "https://example.com/device?user_code=WDJB-MJHT";

describe("openBrowser", () => {
  it("uses open on macOS", async () => {
    const spawn = makeSpawn();

    const opened = await openBrowser(url, { spawn, platform: "darwin" });

    expect(opened).toBe(true);
    expect(spawn).toHaveBeenCalledWith("open", [url], { platform: "darwin" });
  });

  it("uses xdg-open on Linux", async () => {
    const spawn = makeSpawn();

    await openBrowser(url, { spawn, platform: "linux" });

    expect(spawn).toHaveBeenCalledWith("xdg-open", [url], {
      platform: "linux",
    });
  });

  it("uses rundll32 on Windows so the URL never reaches a shell", async () => {
    const spawn = makeSpawn();

    await openBrowser(url, { spawn, platform: "win32" });

    expect(spawn).toHaveBeenCalledWith(
      "rundll32",
      ["url.dll,FileProtocolHandler", url],
      { platform: "win32" },
    );
  });

  it("reports failure when the launcher exits non-zero", async () => {
    const opened = await openBrowser(url, {
      spawn: makeSpawn(1),
      platform: "darwin",
    });

    expect(opened).toBe(false);
  });

  it("reports failure instead of throwing when no launcher exists", async () => {
    const spawn = mock<SpawnFn>(async () => {
      throw Error("spawn xdg-open ENOENT");
    });

    const opened = await openBrowser(url, { spawn, platform: "linux" });

    expect(opened).toBe(false);
  });

  it("refuses to launch anything that is not http or https", async () => {
    const spawn = makeSpawn();

    const opened = await openBrowser("file:///etc/passwd", {
      spawn,
      platform: "darwin",
    });

    expect(opened).toBe(false);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("refuses to launch a value that is not a URL at all", async () => {
    const spawn = makeSpawn();

    const opened = await openBrowser("not a url", {
      spawn,
      platform: "darwin",
    });

    expect(opened).toBe(false);
    expect(spawn).not.toHaveBeenCalled();
  });
});
