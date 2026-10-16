import { describe, expect, it } from "bun:test";

import {
  runWithEnvironment as run,
  sentRequest,
} from "./runFlow.environment.testUtils.js";

describe("handleRunnerRun with --var", () => {
  it("sends a --var on top of the QAWOLF_ENVIRONMENT environment", async () => {
    const { callPublicApi, result } = await run({
      env: { QAWOLF_ENVIRONMENT: "staging" },
      vars: ["RUN_INPUT_PATH=uploads/app.apk"],
    });

    expect(result).toBeUndefined();
    expect(sentRequest(callPublicApi)).toMatchObject({
      env: { RUN_INPUT_PATH: "uploads/app.apk" },
      environmentId: "staging",
    });
  });

  it("sends a --var alone when no environment is named", async () => {
    const { callPublicApi } = await run({ vars: ["A=1"] });
    const request = sentRequest(callPublicApi);

    expect(request).toMatchObject({ env: { A: "1" } });
    expect(Object.hasOwn(request, "environmentId")).toBe(false);
  });

  it("lets a --var replace the file's value of the same name", async () => {
    const { callPublicApi } = await run({
      content: 'A="1"\nB="2"\n',
      envFile: ".env",
      envId: "staging",
      vars: ["A=3"],
    });

    expect(sentRequest(callPublicApi)).toMatchObject({
      env: { A: "3", B: "2" },
      environmentId: "staging",
    });
  });

  it("splits a --var on its first =, so the value may hold one", async () => {
    const { callPublicApi } = await run({ vars: ["QUERY=a=b&c=d", "EMPTY="] });

    expect(sentRequest(callPublicApi)).toMatchObject({
      env: { EMPTY: "", QUERY: "a=b&c=d" },
    });
  });

  it.each(["RUN_INPUT_PATH", "=uploads/app.apk"])(
    "refuses a --var that names no variable, %p, before addressing a runner",
    async (assignment) => {
      const { callPublicApi, result } = await run({ vars: [assignment] });

      expect(result?.error).toContain("--var takes NAME=VALUE");
      expect(result?.exitCode).toBe(2);
      expect(callPublicApi).not.toHaveBeenCalled();
    },
  );

  it("refuses a --var given twice", async () => {
    const { callPublicApi, result } = await run({ vars: ["A=1", "A=2"] });

    expect(result?.error).toContain("more than once");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses a --var the contract will not take", async () => {
    const { callPublicApi, result } = await run({ vars: ["QAWOLF_TEAM_ID=t"] });

    expect(result?.error).toContain("reserved");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });
});
