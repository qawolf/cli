import { describe, expect, it, mock } from "bun:test";

import type { SpawnFn } from "./spawn.js";
import { openBrowser } from "./openBrowser.js";

function makeSpawn(exitCode = 0) {
  return mock<SpawnFn>(async () => ({ exitCode, stdout: "", stderr: "" }));
}

const url = "https://example.com/device?user_code=WDJB-MJHT";

// The launch timeout is a fallback, not part of these assertions: a sleep that
// never settles keeps each test measuring the launcher itself.
const neverSleep = () => new Promise<void>(() => {});

describe("openBrowser", () => {
  it("uses open on macOS", async () => {
    const spawn = makeSpawn();

    const opened = await openBrowser(url, {
      spawn,
      platform: "darwin",
      sleep: neverSleep,
    });

    expect(opened).toBe(true);
    expect(spawn).toHaveBeenCalledWith("open", [url], { platform: "darwin" });
  });

  it("uses xdg-open on Linux", async () => {
    const spawn = makeSpawn();

    await openBrowser(url, { spawn, platform: "linux", sleep: neverSleep });

    expect(spawn).toHaveBeenCalledWith("xdg-open", [url], {
      platform: "linux",
    });
  });

  it("uses rundll32 on Windows so the URL never reaches a shell", async () => {
    const spawn = makeSpawn();

    await openBrowser(url, { spawn, platform: "win32", sleep: neverSleep });

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
      sleep: neverSleep,
    });

    expect(opened).toBe(false);
  });

  it("reports failure instead of throwing when no launcher exists", async () => {
    const spawn = mock<SpawnFn>(async () => {
      throw Error("spawn xdg-open ENOENT");
    });

    const opened = await openBrowser(url, {
      spawn,
      platform: "linux",
      sleep: neverSleep,
    });

    expect(opened).toBe(false);
  });

  it("refuses to launch anything that is not http or https", async () => {
    const spawn = makeSpawn();

    const opened = await openBrowser("file:///etc/passwd", {
      spawn,
      sleep: neverSleep,
      platform: "darwin",
    });

    expect(opened).toBe(false);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("refuses to launch a value that is not a URL at all", async () => {
    const spawn = makeSpawn();

    const opened = await openBrowser("not a url", {
      spawn,
      sleep: neverSleep,
      platform: "darwin",
    });

    expect(opened).toBe(false);
    expect(spawn).not.toHaveBeenCalled();
  });
  // xdg-open may run a foreground handler and not return until the browser is
  // closed. The device flow has to print its next step and start polling long
  // before then, so the launcher is not waited on indefinitely.
  it("stops waiting on a launcher that does not return", async () => {
    const neverSpawn = mock(() => new Promise<never>(() => {}));

    const opened = await openBrowser(url, {
      spawn: neverSpawn as unknown as SpawnFn,
      platform: "linux",
      sleep: async () => {},
    });

    expect(opened).toBe(true);
  });
});
