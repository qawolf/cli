import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "*.config.ts",
    "src/**/*.test.ts",
    "src/**/*.mock.ts",
    "src/**/*.fixtures.ts",
  ],
  project: ["src/**/*.ts"],
  ignoreDependencies: [
    // Resolved at runtime via createRequire in src/commands/flows/runDefaults.ts;
    // knip cannot see the dynamic resolution.
    "playwright",
    // TODO WIZ-10341 follow-up: consumed once the web-flow runner imports it.
    "@playwright/test",
  ],
  ignore: [
    // TODO WIZ-10324: move to its domain when the commands that use it land
    "src/types.ts",
    // TODO WIZ-10325: remove once flowsRun consumes more of the runner surface
    "src/lib/runner/*.ts",
    // TODO WIZ-10326: remove once Reporter is consumed by more than the console reporter
    "src/lib/reporter/*.ts",
    // TODO WIZ-10358: remove once flows pull consumes the trpc client types
    "src/apex/createTrpcClient.ts",
    // TODO WIZ-10355: remove once flows pull consumes the flowsBundle schema
    "src/apex/types.ts",
  ],
};

export default config;
