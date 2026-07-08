import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "*.config.ts",
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
    // TODO WIZ-10341 follow-up: consumed once the web-flow runner imports it.
    "@playwright/test",
    // Installed into the managed runtime dir at runtime by ensureRuntimeEnv; not imported by the CLI.
    "appium",
    "appium-xcuitest-driver",
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
