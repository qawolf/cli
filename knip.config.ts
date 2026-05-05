import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["*.config.ts", "src/**/*.test.ts", "src/**/*.mock.ts"],
  project: ["src/**/*.ts"],
  // TODO WIZ-10324: remove once types are consumed by follow-up commands
  ignoreFiles: ["src/types.ts"],
};

export default config;
