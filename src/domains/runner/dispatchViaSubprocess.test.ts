import { describe, expect, it } from "bun:test";

import type { SpawnFn, SpawnResult } from "~/shell/spawn.js";
import type { BrowserName } from "~/core/types.js";

import {
  createSubprocessDispatch,
  runWorkerOnce,
} from "./dispatchViaSubprocess.js";
import { parseWorkerInput, serializeWorkerResult } from "./workerProtocol.js";
import type { ResolvedFlow } from "./runInternals.js";
import type { RunWebFlowOptions } from "./runWebFlow.js";
import type { RunAndroidFlowOptions } from "./runAndroidFlow.js";
import { passResult } from "./run.fixtures.js";

const webOptions: RunWebFlowOptions = {
  retries: 1,
  outputDir: "out",
  headed: false,
  slowMo: 0,
  video: "off",
  timeout: 30_000,
  har: "off",
  harContent: "omit",
};
const androidOptions: RunAndroidFlowOptions = {
  retries: 1,
  outputDir: "out",
  recordVideo: false,
};

const flow: ResolvedFlow = {
  kind: "web",
  file: "/proj/checkout.ts",
  name: "checkout",
  browser: "chromium" as BrowserName,
};

function fakeSpawn(result: SpawnResult): {
  spawn: SpawnFn;
  calls: { cmd: string; args: string[]; stdin: string | undefined }[];
} {
  const calls: { cmd: string; args: string[]; stdin: string | undefined }[] =
    [];
  const spawn: SpawnFn = (cmd, args, opts) => {
    calls.push({ cmd, args, stdin: opts?.stdin });
    return Promise.resolve(result);
  };
  return { spawn, calls };
}

describe("runWorkerOnce", () => {
  it("parses a successful worker result from stdout", async () => {
    const { spawn } = fakeSpawn({
      exitCode: 0,
      stdout: serializeWorkerResult(passResult({ passed: 2, total: 2 }), 11),
      stderr: "",
    });

    const out = await runWorkerOnce({
      spawn,
      command: "/bin/qawolf",
      prefixArgs: [],
      flow,
      optionsJson: "{}",
    });

    expect(out.run.passed).toBe(true);
    expect(out.run.testCounts).toEqual({ passed: 2, total: 2 });
    expect(out.durationMs).toBe(11);
  });

  it("invokes the worker subcommand with the flow path and options on stdin", async () => {
    const { spawn, calls } = fakeSpawn({
      exitCode: 0,
      stdout: serializeWorkerResult(passResult(), 1),
      stderr: "",
    });

    await runWorkerOnce({
      spawn,
      command: "/usr/bin/node",
      prefixArgs: ["/app/cli.js"],
      flow,
      optionsJson: '{"retries":0}',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.cmd).toBe("/usr/bin/node");
    expect(calls[0]!.args).toEqual([
      "/app/cli.js",
      "flows",
      "__run-worker",
      "/proj/checkout.ts",
    ]);
    expect(calls[0]!.stdin).toBe('{"retries":0}');
  });

  it("synthesizes a failure when the worker crashes without output", async () => {
    const { spawn } = fakeSpawn({
      exitCode: 1,
      stdout: "",
      stderr: "Segmentation fault",
    });

    const out = await runWorkerOnce({
      spawn,
      command: "/bin/qawolf",
      prefixArgs: [],
      flow,
      optionsJson: "{}",
    });

    expect(out.run.passed).toBe(false);
    const err = out.run.error;
    if (err === undefined) throw new Error("expected an error");
    expect(err.flowName).toBe("checkout");
    expect((err.cause as Error).message).toContain("Segmentation fault");
  });
});

describe("createSubprocessDispatch", () => {
  it("sends the flow path on argv and the worker input on stdin", async () => {
    const { spawn, calls } = fakeSpawn({
      exitCode: 0,
      stdout: serializeWorkerResult(passResult(), 3),
      stderr: "",
    });

    const dispatch = createSubprocessDispatch({
      spawn,
      command: "/bin/qawolf",
      prefixArgs: [],
      resolvedDir: "/proj",
      webOptions,
      androidOptions,
    });

    const out = await dispatch(flow);

    expect(out.run.passed).toBe(true);
    expect(calls[0]!.args).toEqual([
      "flows",
      "__run-worker",
      "/proj/checkout.ts",
    ]);
    const sent = parseWorkerInput(calls[0]!.stdin ?? "");
    expect(sent.resolvedDir).toBe("/proj");
    expect(sent.flow.name).toBe("checkout");
    expect(sent.webOptions.timeout).toBe(30_000);
  });
});
