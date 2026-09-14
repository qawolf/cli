import { describe, expect, it, mock } from "bun:test";

import { createCopyToClipboard } from "./clipboard.js";
import type { SpawnFn } from "./spawn.js";

/** A spawn where only the named tools succeed. */
function spawnAnswering(working: readonly string[]) {
  return mock<SpawnFn>((cmd) =>
    Promise.resolve({
      exitCode: working.includes(cmd) ? 0 : 1,
      stdout: "",
      stderr: "",
    }),
  );
}

const tried = (spawn: ReturnType<typeof spawnAnswering>): string[] =>
  spawn.mock.calls.map((call) => call[0]);

describe("createCopyToClipboard", () => {
  it("copies with pbcopy on macOS, passing the text on stdin", async () => {
    const spawn = spawnAnswering(["pbcopy"]);
    const copy = createCopyToClipboard({
      platform: "darwin",
      env: {},
      spawn,
      writeTerminal: mock(),
    });

    expect(await copy("src/flows/a.flow.ts")).toBe("copied");
    expect(spawn).toHaveBeenCalledWith("pbcopy", [], {
      platform: "darwin",
      stdin: "src/flows/a.flow.ts",
    });
  });

  it("tries wl-copy first under Wayland, then xclip", async () => {
    const spawn = spawnAnswering(["xclip"]);
    const copy = createCopyToClipboard({
      platform: "linux",
      env: { WAYLAND_DISPLAY: "wayland-0" },
      spawn,
      writeTerminal: mock(),
    });

    expect(await copy("x")).toBe("copied");
    expect(tried(spawn)).toEqual(["wl-copy", "xclip"]);
  });

  it("skips wl-copy without Wayland", async () => {
    const spawn = spawnAnswering(["xclip"]);
    const copy = createCopyToClipboard({
      platform: "linux",
      env: {},
      spawn,
      writeTerminal: mock(),
    });

    await copy("x");
    expect(tried(spawn)).toEqual(["xclip"]);
  });

  // Over SSH there is no local clipboard tool, but the terminal has one.
  it("asks the terminal to copy when no tool works", async () => {
    const writeTerminal = mock();
    const copy = createCopyToClipboard({
      platform: "linux",
      env: {},
      spawn: spawnAnswering([]),
      writeTerminal,
    });

    expect(await copy("hello")).toBe("terminal");
    expect(writeTerminal).toHaveBeenCalledWith("\x1b]52;c;aGVsbG8=\x07");
  });

  it("treats a tool that cannot start as missing", async () => {
    const writeTerminal = mock();
    const copy = createCopyToClipboard({
      platform: "darwin",
      env: {},
      spawn: mock<SpawnFn>(() => Promise.reject(new Error("ENOENT"))),
      writeTerminal,
    });

    expect(await copy("x")).toBe("terminal");
    expect(writeTerminal).toHaveBeenCalledTimes(1);
  });
});
