import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "*.config.ts",
    "src/**/*.test.ts",
    "src/**/*.mock.ts",
    "src/**/*.fixtures.ts",
  ],
  project: ["src/**/*.ts"],
  ignore: [
    // TODO WIZ-10324: move to its domain when the commands that use it land
    "src/types.ts",
    // TODO WIZ-10325: remove once createRunner is wired to the flows run command
    "src/lib/runner/*.ts",
    // TODO WIZ-10326: remove once Reporter is consumed by the console reporter
    "src/lib/reporter/*.ts",
    // TODO WIZ-10358: remove once flows pull consumes the trpc client types
    "src/apex/createTrpcClient.ts",
  ],
};

export default config;
