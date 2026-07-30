import { describe, expect, it } from "bun:test";

import { toolNotInstalled, toolNotRunnable } from "./toolNotFound.js";

describe("toolNotInstalled", () => {
  it("names the path it looked for", () => {
    expect(
      toolNotInstalled("Playwright", "/env/node_modules/.bin/playwright"),
    ).toBe(
      "Playwright not found at /env/node_modules/.bin/playwright.\n" +
        "Run `qawolf install` to install the runtime dependencies.",
    );
  });

  it("keeps the same remedy when no path is known", () => {
    expect(toolNotInstalled("Appium")).toBe(
      "Appium is not installed.\n" +
        "Run `qawolf install` to install the runtime dependencies.",
    );
  });
});

describe("toolNotRunnable", () => {
  it("keeps the failure detail and gives the same remedy", () => {
    expect(
      toolNotRunnable("Could not run `appium driver list`", "ENOENT"),
    ).toBe(
      "Could not run `appium driver list` (ENOENT).\n" +
        "Run `qawolf install` to install the runtime dependencies.",
    );
  });
});
