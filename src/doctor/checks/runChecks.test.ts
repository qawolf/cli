import { afterEach, describe, expect, it, mock } from "bun:test";

import type { SpawnFn, SpawnResult } from "~/doctor/types.js";

import { runChecks } from "./index.js";

afterEach(() => {
  mock.restore();
});

describe("runChecks", () => {
  it("runs the standard checks in order with no flow files", async () => {
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
      flowFiles: [],
      readFile: () => Promise.resolve(""),
      cwd: "/repo",
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

  it("appends one warn per flow file referencing QAWOLF_*_DIR", async () => {
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
    const sources: Record<string, string> = {
      "/repo/.qawolf/staging/upload.flow.ts":
        "process.env.QAWOLF_SCREENSHOTS_DIR;",
      "/repo/.qawolf/staging/login.flow.ts": 'flow("Login", async () => {})',
    };

    const results = await runChecks({
      env: { QAWOLF_API_KEY: "x" },
      fetch,
      spawn,
      apiBaseUrl: "https://app.qawolf.com",
      enginesNode: ">=24",
      processVersion: "v24.0.0",
      flowFiles: Object.keys(sources),
      readFile: (path) => Promise.resolve(sources[path] ?? ""),
      cwd: "/repo",
    });

    const warns = results.filter((r) => r.name === "file-assets");
    expect(warns).toHaveLength(1);
    expect(warns[0]?.status).toBe("warn");
    expect(warns[0]?.detail).toContain("upload.flow.ts");
    expect(warns[0]?.detail).toContain("QAWOLF_SCREENSHOTS_DIR");
  });
});
