import { describe, expect, it } from "bun:test";

import { isRuntimeProvidedEnvVar } from "./runtimeEnvVars.js";

describe("isRuntimeProvidedEnvVar", () => {
  it("treats runner and OS variables as provided", () => {
    for (const name of [
      "QAWOLF_EXAMPLE_ID",
      "QAWOLF_EXAMPLE_DIR",
      "TEAM_STORAGE_DIR",
      "RUN_INPUT_PATH",
      "RUN_EXAMPLE_DIR",
      "PW_EXAMPLE_OPTION",
      "PLAYWRIGHT_EXAMPLE_OPTION",
      "HOME",
      "CI",
    ]) {
      expect(isRuntimeProvidedEnvVar(name)).toBe(true);
    }
  });

  it("treats ordinary environment variables as not provided", () => {
    for (const name of ["EXAMPLE_PASSWORD", "EXAMPLE_EMAIL", "EXAMPLE_URL"]) {
      expect(isRuntimeProvidedEnvVar(name)).toBe(false);
    }
  });
});
