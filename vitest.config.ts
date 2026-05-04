import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    exclude: [...defaultExclude, "src/bunSmoke.test.ts"],
  },
});
