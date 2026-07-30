import { describe, expect, it } from "bun:test";

import { toolMissingFromDepsRoot, toolNotInstalled } from "./toolNotFound.js";

describe("toolNotInstalled", () => {
  it("names the path it looked for and points at `qawolf install`", () => {
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

describe("toolMissingFromDepsRoot", () => {
  it("blames the resolved deps root instead of repeating `qawolf install`", () => {
    expect(
      toolMissingFromDepsRoot("Appium", "/env/node_modules/.bin/appium"),
    ).toBe(
      "Appium not found at /env/node_modules/.bin/appium.\n" +
        "The resolved dependencies directory is incomplete. " +
        "Run `qawolf install clear`, then retry.",
    );
  });
});
