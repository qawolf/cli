import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { parseExecutionTarget } from "@qawolf/flow-targets";
import { mockExpectWebdriverio } from "./expectWebdriverio.fixtures.js";
import { _resetInitCache, initFlowRuntime } from "./initFlowRuntime.js";

mockExpectWebdriverio();

afterEach(() => {
  _resetInitCache();
});

const thisDir = import.meta.dirname;

/** Reads back the target and mobile expect timeout configured on @qawolf/flows. */
async function readConfiguredMobileState(): Promise<{
  platform: string;
  expectTimeoutMs: number | undefined;
}> {
  const idxUrl = import.meta.resolve("@qawolf/flows");
  const { getCurrentTarget } = (await import(
    new URL("./targetScope.js", idxUrl).href
  )) as { getCurrentTarget: () => { platform: string } };
  const { getMobileExpectAttributes } = (await import(
    new URL("./mobile/expect/attributes.js", idxUrl).href
  )) as {
    getMobileExpectAttributes: () => { expectTimeoutMs: number | undefined };
  };
  return {
    platform: getCurrentTarget().platform,
    expectTimeoutMs: getMobileExpectAttributes().expectTimeoutMs,
  };
}

const androidTarget = parseExecutionTarget("Android - Pixel 9 (Android 15)");

describe("initFlowRuntime target", () => {
  it("configures the passed Android target and the mobile expect timeout", async () => {
    await initFlowRuntime(path.join(thisDir, "fake.flow.ts"), {
      timeout: 7_000,
      target: androidTarget,
    });
    expect(await readConfiguredMobileState()).toEqual({
      platform: "android",
      expectTimeoutMs: 7_000,
    });
  });

  it("configures the web target again after an Android flow in the same directory", async () => {
    const flowPath = path.join(thisDir, "fake.flow.ts");
    await initFlowRuntime(flowPath, { timeout: 30_000 });
    await initFlowRuntime(flowPath, {
      timeout: 30_000,
      target: androidTarget,
    });
    await initFlowRuntime(flowPath, { timeout: 30_000 });
    expect((await readConfiguredMobileState()).platform).toBe("web");
  });
});
