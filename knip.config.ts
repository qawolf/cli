import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["*.config.ts", "src/**/*.test.ts", "src/**/*.mock.ts"],
  project: ["src/**/*.ts"],
  // temporarily ignore src/types.ts until it is in use in follow-ups
  ignoreFiles: ["src/types.ts"],
};

export default config;
