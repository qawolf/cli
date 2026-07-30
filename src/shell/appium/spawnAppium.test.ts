import { describe, expect, it } from "bun:test";

import { buildAppiumSpawnOptions } from "./spawnAppium.js";

describe("buildAppiumSpawnOptions", () => {
  const env = { APPIUM_HOME: "/data/appium" };

  it("pipes stdout and stderr and passes the env through", () => {
    expect(
      buildAppiumSpawnOptions("/envs/node20/.bin/appium", "linux", env),
    ).toEqual({
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
  });

  it("sets shell on win32 so Node will run the .cmd shim", () => {
    expect(
      buildAppiumSpawnOptions(
        "C:\\envs\\node20\\.bin\\appium.cmd",
        "win32",
        env,
      ).shell,
    ).toBe(true);
  });
});
