import { describe, expect, it } from "bun:test";

import { restoreComSpecAfterEach } from "~/shell/spawn.testUtils.js";
import { buildAppiumSpawn } from "./spawnAppium.js";

restoreComSpecAfterEach();

describe("buildAppiumSpawn", () => {
  const env = { APPIUM_HOME: "/data/appium" };

  it("pipes stdout and stderr and passes the env through", () => {
    expect(
      buildAppiumSpawn(
        "/envs/node20/.bin/appium",
        ["--port", "4723"],
        "linux",
        env,
      ),
    ).toEqual({
      cmd: "/envs/node20/.bin/appium",
      args: ["--port", "4723"],
      options: { stdio: ["ignore", "pipe", "pipe"], env },
    });
  });

  it("routes the .cmd shim through cmd.exe on win32, keeping stdio", () => {
    process.env["ComSpec"] = "C:\\Windows\\System32\\cmd.exe";
    const built = buildAppiumSpawn(
      "C:\\envs\\node20\\.bin\\appium.cmd",
      ["--port", "4723"],
      "win32",
      env,
    );
    expect(built.cmd).toBe("C:\\Windows\\System32\\cmd.exe");
    expect(built.args).toEqual([
      "/d",
      "/s",
      "/c",
      '"C:\\envs\\node20\\.bin\\appium.cmd ^^^"--port^^^" ^^^"4723^^^""',
    ]);
    expect(built.options.stdio).toEqual(["ignore", "pipe", "pipe"]);
    expect(built.options.windowsVerbatimArguments).toBe(true);
    expect(built.options.shell).toBeUndefined();
  });
});
