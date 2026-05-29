import { describe, expect, it } from "bun:test";

import { resolveWorkerCommand } from "./workerCommand.js";

describe("resolveWorkerCommand", () => {
  it("invokes the binary directly when compiled", () => {
    const out = resolveWorkerCommand({
      execPath: "/usr/local/bin/qawolf",
      scriptPath: undefined,
      compiled: true,
    });
    expect(out).toEqual({ command: "/usr/local/bin/qawolf", prefixArgs: [] });
  });

  it("invokes the runtime with the script path when not compiled", () => {
    const out = resolveWorkerCommand({
      execPath: "/usr/bin/node",
      scriptPath: "/app/dist/cli.js",
      compiled: false,
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
      }),
    ).toThrow("worker entrypoint");
  });
});
