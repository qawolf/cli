import { describe, expect, it } from "bun:test";

import { flowsMessages } from "~/core/messages/index.js";

import { allEnvsNoEffectWarning } from "./allEnvsWarning.js";

describe("allEnvsNoEffectWarning", () => {
  it("is silent when --all-envs was not given", () => {
    expect(
      allEnvsNoEffectWarning({ allEnvs: false, env: "staging", tags: [] }),
    ).toBeUndefined();
  });

  it("warns that --env already pins the run to one environment", () => {
    expect(
      allEnvsNoEffectWarning({ allEnvs: true, env: "staging", tags: ["auth"] }),
    ).toBe(flowsMessages.selectors.allEnvsWithEnv);
  });

  it("warns that without --tag there is nothing to widen", () => {
    expect(
      allEnvsNoEffectWarning({ allEnvs: true, env: undefined, tags: [] }),
    ).toBe(flowsMessages.selectors.allEnvsWithoutTag);
  });

  it("is silent when the flag has work to do", () => {
    expect(
      allEnvsNoEffectWarning({ allEnvs: true, env: undefined, tags: ["auth"] }),
    ).toBeUndefined();
  });
});
