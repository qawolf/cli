import { describe, expect, it } from "bun:test";

import { exitCodes } from "~/shell/exit.js";
import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";

import type { SdkContext } from "./createContext.js";
import { createLifecycleVerbs } from "./lifecycleVerbs.js";

// What the platform layer builds from a 404 on a runner route.
const notRunning = {
  error: "Runner agent-1 is not running (HTTP 404).",
  errorBody: [
    "It was never launched, or it has since been terminated or idled out.",
    "Launch it with qawolf runner launch --id agent-1, or send this to a different runner with --runner.",
    "The id agent-1 is the one this call named.",
  ].join("\n"),
  exitCode: exitCodes.notFound,
  ok: false as const,
};

function lifecycleAnswering(answer: unknown) {
  const platformClient = {
    callPublicApi: async () => answer,
  } as unknown as PlatformClient;
  return createLifecycleVerbs({ platformClient } as unknown as SdkContext);
}

describe("an SDK verb whose runner is gone", () => {
  // Without this the caller got the headline alone, and the half that says
  // what to do about it was built and then thrown away.
  it("carries the detail line, not just the headline", async () => {
    const result = await lifecycleAnswering(notRunning).keepalive({
      runnerId: "agent-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(notRunning.error);
    expect(result.errorDetail).toContain("qawolf runner launch --id agent-1");
    expect(result.errorDetail).toContain("the one this call named");
  });

  it("leaves an unreachable runner with no detail to add", async () => {
    const result = await lifecycleAnswering({
      ok: true,
      value: { failureReason: "runner-unreachable", outcome: "failure" },
    }).keepalive({ runnerId: "agent-1" });

    expect(result).toEqual({
      error: "The runner could not be reached.",
      ok: false,
    });
  });
});
