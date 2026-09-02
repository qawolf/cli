import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "*.config.ts",
    "src/runnerSdk/index.ts",
    "src/**/*.test.ts",
    "src/**/*.mock.ts",
    "src/**/*.fixtures.ts",
    "src/**/*.testUtils.ts",
  ],
  project: ["src/**/*.ts"],
  ignoreBinaries: [
    // the built bundle, invoked as `node dist/cli.js` in the runtime-smoke CI
    // job; not present when knip runs (it runs before the build step)
    "dist/cli.js",
  ],
  ignoreDependencies: [
    // devDependencies kept only so genDependencyVersions.ts can read their
    // installed versions. The CLI never imports either: ensureRuntimeEnv
    // installs appium into the managed runtime dir and spawns its .bin shim,
    // and `qawolf install android` passes the driver version to
    // `appium driver install` inside APPIUM_HOME. Listing them as dependencies
    // would ship their peer graphs to every consumer — see pinnedPackages.ts.
    "appium",
    "appium-uiautomator2-driver",
  ],
  ignore: [
    // TODO WIZ-10325: remove once flowsRun consumes more of the runner surface
    "src/domains/runner/*.ts",
    // TODO WIZ-10326: remove once Reporter is consumed by more than the console reporter
    "src/shell/reporter/*.ts",
    // TODO WIZ-10355: remove once flows pull consumes the flowsBundle schema
    "src/shell/platform/types.ts",
    // TODO WIZ-10339 follow-up: consumed once wireErrors is called from the pull handler
    "src/domains/flows/pull/wireErrors.ts",
  ],
};

export default config;
