import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import {
  playwrightCliInvocation,
  playwrightCliJsPath,
} from "./playwrightCli.js";

describe("playwrightCliJsPath", () => {
  it("points inside the playwright package, not node_modules/.bin", () => {
    expect(playwrightCliJsPath("/env")).toBe(
      join("/env", "node_modules", "playwright", "cli.js"),
    );
  });
});

describe("playwrightCliInvocation", () => {
  it("runs cli.js through the given exec path with BUN_BE_BUN set", () => {
    expect(
      playwrightCliInvocation({
        envDir: "/env",
        execPath: "/usr/bin/node",
        cliArgs: ["install", "chromium"],
      }),
    ).toEqual({
      cmd: "/usr/bin/node",
      args: [
        join("/env", "node_modules", "playwright", "cli.js"),
        "install",
        "chromium",
      ],
      env: { BUN_BE_BUN: "1" },
    });
  });
});
