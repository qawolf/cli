import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["*.config.ts", "src/**/*.test.ts", "src/**/*.mock.ts"],
  project: ["src/**/*.ts"],
  // TODO WIZ-10324: move to its domain when the commands that use it land
  // TODO WIZ-10325: remove once createRunner is wired to the flows run command
  // TODO WIZ-10326: remove once Reporter is consumed by the console reporter
  ignore: ["src/types.ts", "src/lib/runner/*.ts", "src/lib/reporter/*.ts"],
};

export default config;
