import { describe, expect, it } from "bun:test";

import { resolveEnvironment } from "./resolveEnvironment.js";
import { env, makeDeps } from "./resolveEnvironment.testUtils.js";

describe("resolveEnvironment identity", () => {
  // Every other fixture omits the alias, so this is the only cover for the
  // path that actually records a slug in the manifest.
  it("carries the alias through as the slug", async () => {
    const { deps } = makeDeps({
      getEnv: env("env-1", "Staging", "static", false, "staging"),
    });

    const outcome = await resolveEnvironment(deps, {
      explicit: "staging",
      requiredMessage: "req",
    });

    expect(outcome).toEqual({
      kind: "resolved",
      env: "env-1",
      slug: "staging",
      name: "Staging",
    });
  });
});
