import { describe, expect, it } from "bun:test";

import { resolveWorkerCommand } from "./workerCommand.js";

describe("resolveWorkerCommand", () => {
  it("runs the embedded cli.js as a Bun runtime when compiled with a worker bundle", () => {
    const out = resolveWorkerCommand({
      execPath: "/usr/local/bin/qawolf",
      scriptPath: undefined,
      compiled: true,
      workerCliPath: "/data/qawolf/worker/cli-abc123.js",
    });
    expect(out).toEqual({
      command: "/usr/local/bin/qawolf",
      prefixArgs: ["/data/qawolf/worker/cli-abc123.js"],
      env: { BUN_BE_BUN: "1" },
    });
  });

  it("invokes the binary directly when compiled without an embedded bundle", () => {
    const out = resolveWorkerCommand({
      execPath: "/usr/local/bin/qawolf",
      scriptPath: undefined,
      compiled: true,
      workerCliPath: undefined,
    });
    expect(out).toEqual({ command: "/usr/local/bin/qawolf", prefixArgs: [] });
  });

  it("invokes the runtime with the script path when not compiled", () => {
    const out = resolveWorkerCommand({
      execPath: "/usr/bin/node",
      scriptPath: "/app/dist/cli.js",
      compiled: false,
      workerCliPath: undefined,
    });
    expect(out).toEqual({
      command: "/usr/bin/node",
      prefixArgs: ["/app/dist/cli.js"],
    });
  });

  it("throws when not compiled and the script path is unknown", () => {
    expect(() =>
      resolveWorkerCommand({
        execPath: "/usr/bin/node",
        scriptPath: undefined,
        compiled: false,
        workerCliPath: undefined,
      }),
    ).toThrow("worker entrypoint");
  });
});
