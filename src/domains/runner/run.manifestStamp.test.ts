import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { writeManifest } from "~/shell/manifest/io.js";
import { findFlowStamp } from "~/shell/manifest/lookup.js";
import type { Manifest } from "~/shell/manifest/types.js";

import { defaultFlags, makeDeps, passResult } from "./run.fixtures.js";
import { dispatchFlow } from "./runInternals.js";

let workDir = "";
let envDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-stamp-"));
  envDir = join(workDir, ".qawolf", "staging");
  await mkdir(envDir, { recursive: true });
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
  mock.restore();
});

const sampleManifest = (): Manifest => ({
  envId: "env-abc",
  envSlug: undefined,
  fetchedAt: "2026-05-10T12:00:00.000Z",
  cliFlowsVersion: "0.1.0",
  qawolfCommitSha: undefined,
  qawolfCommittedAt: undefined,
  envVarsFetchedAt: undefined,
  flows: [{ path: "login.flow.ts", contentHash: "hash-login" }],
});

describe("dispatchFlow manifest stamping", () => {
  it("stamps envId, path, contentHash on the FlowRunResult when the flow is under .qawolf/<env>/", async () => {
    await writeManifest(envDir, sampleManifest());
    const flowFile = join(envDir, "login.flow.ts");
    await writeFile(flowFile, "// login", "utf8");

    const deps = {
      ...makeDeps({
        runResults: [passResult({ passed: 1, total: 1 })],
      }),
      findFlowStamp,
    };

    const { run } = await dispatchFlow({
      deps,
      flow: {
        kind: "web",
        file: flowFile,
        name: "Login",
        browser: "chromium",
      },
      webOptions: {
        retries: 0,
        outputDir: "qawolf-output",
        headed: false,
        slowMo: 0,
        video: "off",
        trace: "off",
        timeout: defaultFlags().timeout,
      },
      androidOptions: {
        retries: 0,
        outputDir: "qawolf-output",
        recordVideo: false,
      },
    });

    expect(run.manifest).toEqual({
      envId: "env-abc",
      path: "login.flow.ts",
      contentHash: "hash-login",
    });
    expect(run.passed).toBe(true);
  });

  it("leaves manifest undefined for flows outside .qawolf/<env>/", async () => {
    const flowFile = join(workDir, "outside.flow.ts");
    await writeFile(flowFile, "// outside", "utf8");

    const deps = {
      ...makeDeps({
        runResults: [passResult({ passed: 1, total: 1 })],
      }),
      findFlowStamp,
    };

    const { run } = await dispatchFlow({
      deps,
      flow: {
        kind: "web",
        file: flowFile,
        name: "Outside",
        browser: "chromium",
      },
      webOptions: {
        retries: 0,
        outputDir: "qawolf-output",
        headed: false,
        slowMo: 0,
        video: "off",
        trace: "off",
        timeout: defaultFlags().timeout,
      },
      androidOptions: {
        retries: 0,
        outputDir: "qawolf-output",
        recordVideo: false,
      },
    });

    expect(run.manifest).toBeUndefined();
  });

  it("preserves the run result and warns via deps.warn when findFlowStamp throws", async () => {
    const flowFile = join(envDir, "login.flow.ts");
    await writeFile(flowFile, "// login", "utf8");

    const deps = {
      ...makeDeps({
        runResults: [passResult({ passed: 1, total: 1 })],
      }),
      findFlowStamp: () =>
        Promise.reject(new Error("EACCES: permission denied")),
    };

    const { run } = await dispatchFlow({
      deps,
      flow: {
        kind: "web",
        file: flowFile,
        name: "Login",
        browser: "chromium",
      },
      webOptions: {
        retries: 0,
        outputDir: "qawolf-output",
        headed: false,
        slowMo: 0,
        video: "off",
        trace: "off",
        timeout: defaultFlags().timeout,
      },
      androidOptions: {
        retries: 0,
        outputDir: "qawolf-output",
        recordVideo: false,
      },
    });

    expect(run.passed).toBe(true);
    expect(run.manifest).toBeUndefined();
    expect(deps.warn).toHaveBeenCalledTimes(1);
    const warnCall = (deps.warn as ReturnType<typeof mock>).mock.calls[0];
    expect(warnCall?.[0]).toContain("failed to read manifest stamp");
    expect(warnCall?.[0]).toContain("EACCES: permission denied");
  });
});
