import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { pathExists } from "~/lib/fs.js";
import { envVarsTrpcPath, requestEnvVars, writeEnvFile } from "./envVars.js";
import {
  envVarsPath,
  makeFakeFetch,
  testApiKey,
  testBaseUrl,
} from "./pull.fixtures.js";
import { expectRejects } from "./pull.testUtils.js";

let workDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-envvars-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("writeEnvFile", () => {
  it("writes the file at <dir>/.env with mode 0600", async () => {
    await writeEnvFile(workDir, { TOKEN: "abc", URL: "https://example.com" });

    const body = await readFile(join(workDir, ".env"), "utf8");
    expect(body).toBe('TOKEN="abc"\nURL="https://example.com"\n');
    const s = await stat(join(workDir, ".env"));
    expect(s.mode & 0o777).toBe(0o600);
  });

  it("skips writing .env when no vars are present", async () => {
    await writeEnvFile(workDir, {});

    expect(await pathExists(join(workDir, ".env"))).toBe(false);
  });
});

describe("requestEnvVars", () => {
  const deps = (fetch: typeof globalThis.fetch) => ({
    apiKey: testApiKey,
    baseUrl: testBaseUrl,
    fetch,
    sleep: async (): Promise<void> => {},
  });

  it("sends a Bearer-authed GET to the env-vars tRPC route", async () => {
    const fakeFetch = makeFakeFetch({
      kind: "ok",
      sourceArchive: "/dev/null",
      envVars: { TOKEN: "abc" },
    });

    const vars = await requestEnvVars(deps(fakeFetch.fetch), "env-abc");

    expect(vars).toEqual({ TOKEN: "abc" });
    const call = fakeFetch.calls[0];
    expect(call?.url).toContain(`/api/trpc/${envVarsPath}`);
    expect(call?.init?.method).toBe("GET");
    const headers = call?.init?.headers as Record<string, string> | undefined;
    expect(headers?.["Authorization"]).toBe(`Bearer ${testApiKey}`);
  });

  it("sends the envId in the `id` field (not `envId`)", async () => {
    const fakeFetch = makeFakeFetch({
      kind: "ok",
      sourceArchive: "/dev/null",
      envVars: {},
    });

    await requestEnvVars(deps(fakeFetch.fetch), "env-abc");

    const encoded = new URL(fakeFetch.calls[0]!.url).searchParams.get("input");
    expect(encoded).not.toBeNull();
    const parsed = JSON.parse(encoded!) as { json: Record<string, string> };
    expect(parsed.json).toEqual({ id: "env-abc" });
  });

  it("exports the same tRPC path constant the fixture intercepts on", () => {
    expect(envVarsTrpcPath).toBe(envVarsPath);
  });

  it("surfaces a 404 as a not-found message naming --env", async () => {
    const fakeFetch = makeFakeFetch({
      kind: "envVarsError",
      status: 404,
      body: "env not found",
    });

    await expectRejects(
      requestEnvVars(deps(fakeFetch.fetch), "env-abc"),
      /could not find env-vars for that environment/i,
    );
  });

  it("retries on a transient network error and succeeds on retry", async () => {
    const fakeFetch = makeFakeFetch([
      { kind: "networkError", error: new TypeError("fetch failed") },
      {
        kind: "ok",
        sourceArchive: "/dev/null",
        envVars: { TOKEN: "after-retry" },
      },
    ]);

    const vars = await requestEnvVars(deps(fakeFetch.fetch), "env-abc");

    expect(vars).toEqual({ TOKEN: "after-retry" });
    expect(fakeFetch.calls).toHaveLength(2);
  });

  it("does not retry on a 401 (deterministic auth failure)", async () => {
    const fakeFetch = makeFakeFetch([
      { kind: "envVarsError", status: 401, body: "unauthorized" },
      {
        kind: "ok",
        sourceArchive: "/dev/null",
        envVars: { TOKEN: "should-not-arrive" },
      },
    ]);

    await expectRejects(
      requestEnvVars(deps(fakeFetch.fetch), "env-abc"),
      /API key/i,
    );
    expect(fakeFetch.calls).toHaveLength(1);
  });
});
