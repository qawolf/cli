import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import type { CommandContext } from "~/shell/commandContext.js";
import type { SpawnFn } from "~/shell/spawn.js";

import { installBrowserList } from "./browsers.js";

const envDir = "/fake/env";
const playwrightCliJs = join(envDir, "node_modules", "playwright", "cli.js");

const ctx = {
  ui: { withProgress: () => Promise.resolve() },
} as unknown as CommandContext;

const spawn: SpawnFn = () =>
  Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });

describe("installBrowserList", () => {
  it("blames the resolved deps root when playwright's cli.js is missing", async () => {
    let caught: unknown;
    try {
      await installBrowserList(ctx, ["chromium"], {
        spawn,
        execPath: "/fake/bin/node",
        platform: "linux",
        browserDeps: false,
        envDir,
        checkExists: () => false,
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe(
      `Playwright not found at ${playwrightCliJs}.\n` +
        "Run `qawolf install` to install the runtime dependencies.",
    );
  });
});
