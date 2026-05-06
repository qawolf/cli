import { afterEach, describe, expect, it, mock } from "bun:test";

import type { SpawnFn, SpawnResult } from "~/doctor/types.js";

import { runChecks } from "./index.js";

afterEach(() => {
  mock.restore();
});

describe("runChecks", () => {
  it("runs all five checks in order", async () => {
    const spawn = mock<SpawnFn>(() =>
      Promise.resolve<SpawnResult>({
        exitCode: 0,
        stdout: "Version 1.49.1",
        stderr: "",
      }),
    );
    const fetch = mock<typeof globalThis.fetch>().mockResolvedValue(
      new Response(undefined, { status: 200 }),
    ) as unknown as typeof globalThis.fetch;

    const results = await runChecks({
      env: { QAWOLF_API_KEY: "x" },
      fetch,
      spawn,
      apiBaseUrl: "https://app.qawolf.com",
      enginesNode: ">=24",
      processVersion: "v24.0.0",
    });

    expect(results.map((result) => result.name)).toEqual([
      "node-version",
      "playwright",
      "api-key",
      "api-url",
      "npm-registry",
    ]);
    expect(results.every((result) => result.status === "pass")).toBe(true);
  });
});
