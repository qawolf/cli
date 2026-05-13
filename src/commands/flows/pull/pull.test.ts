import { mkdir, mkdtemp, rm, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  flowsBundlePath,
  testApiKey,
  testBaseUrl,
  buildBundle,
  makeFakeFetch,
} from "./pull.fixtures.js";
import {
  checkSafety,
  downloadBundle,
  requestBundle,
  validateEnvId,
} from "./pull.js";
import { expectRejects } from "./pull.testUtils.js";

let workDir = "";
let bundleArchive = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-pull-"));
  bundleArchive = join(workDir, "bundle.tar.gz");
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("validateEnvId", () => {
  it("accepts UUID-style ids", () => {
    expect(validateEnvId("01234567-89ab-cdef-0123-456789abcdef")).toBe("ok");
  });

  it("accepts kebab-case slugs", () => {
    expect(validateEnvId("env-abc")).toBe("ok");
    expect(validateEnvId("f4844gq8r2lnuskkp88eonteoenv")).toBe("ok");
  });

  it("rejects strings with whitespace or punctuation", () => {
    const r = validateEnvId("Bad Env!");
    expect(r).not.toBe("ok");
    if (r !== "ok") expect(r.error).toMatch(/UUID|kebab/i);
  });
});

describe("requestBundle", () => {
  it("sends a Bearer-authed POST to gitwolf.getFlowsBundleUrl", async () => {
    const fakeFetch = makeFakeFetch({
      kind: "ok",
      sourceArchive: bundleArchive,
    });

    const result = await requestBundle(
      {
        apiKey: testApiKey,
        baseUrl: testBaseUrl,
        fetch: fakeFetch.fetch,
      },
      "env-abc",
    );

    const call = fakeFetch.calls[0];
    expect(call?.url).toContain(`${testBaseUrl}/api/trpc/${flowsBundlePath}`);
    expect(call?.init?.method).toBe("POST");
    const headers = call?.init?.headers as Record<string, string> | undefined;
    expect(headers?.["Authorization"]).toBe(`Bearer ${testApiKey}`);
    expect(result.signedUrl).toMatch(/^https:\/\//);
  });

  it("surfaces a 404 as a not-found message naming --env", async () => {
    const fakeFetch = makeFakeFetch({
      kind: "bundleError",
      status: 404,
      body: "env not found",
    });

    await expectRejects(
      requestBundle(
        {
          apiKey: testApiKey,
          baseUrl: testBaseUrl,
          fetch: fakeFetch.fetch,
        },
        "env-abc",
      ),
      /could not find that environment|--env/i,
    );
  });

  it("surfaces a 401 as an API-key message", async () => {
    const fakeFetch = makeFakeFetch({
      kind: "bundleError",
      status: 401,
      body: "unauthorized",
    });

    await expectRejects(
      requestBundle(
        {
          apiKey: testApiKey,
          baseUrl: testBaseUrl,
          fetch: fakeFetch.fetch,
        },
        "env-abc",
      ),
      /API key/i,
    );
  });
});

describe("downloadBundle", () => {
  it("writes the signed-URL response to a tmp .tar.gz file", async () => {
    await buildBundle(bundleArchive, {
      flows: [{ name: "a.flow.ts", data: "ok" }],
      bundleFlowsVersion: "0.5.0",
    });
    const fakeFetch = makeFakeFetch({
      kind: "ok",
      sourceArchive: bundleArchive,
    });

    // requestBundle is what produces the signed URL in real flow; here we
    // can call the fake fetch helper directly with the canonical URL since
    // the fixture routes by URL.
    const { signedUrl } = await requestBundle(
      {
        apiKey: testApiKey,
        baseUrl: testBaseUrl,
        fetch: fakeFetch.fetch,
      },
      "env-abc",
    );

    const result = await downloadBundle({ fetch: fakeFetch.fetch }, signedUrl);
    try {
      expect(result.tmpArchive).toMatch(/qawolf-pull-[0-9a-f]+\.tar\.gz$/);
      const s = await stat(result.tmpArchive);
      expect(s.size).toBeGreaterThan(0);
    } finally {
      await unlink(result.tmpArchive).catch(() => {});
    }
  });

  it("throws an expired-URL message on 403 from the signed URL", async () => {
    const fakeFetch = makeFakeFetch({
      kind: "downloadError",
      status: 403,
      body: "<Error>SignatureExpired</Error>",
    });
    const { signedUrl } = await requestBundle(
      {
        apiKey: testApiKey,
        baseUrl: testBaseUrl,
        fetch: fakeFetch.fetch,
      },
      "env-abc",
    );

    await expectRejects(
      downloadBundle({ fetch: fakeFetch.fetch }, signedUrl),
      /expired|run.+pull.+again/i,
    );
  });
});

describe("checkSafety", () => {
  it("returns 'proceed' when no manifest exists at envDir", async () => {
    const envDir = join(workDir, "env");
    await mkdir(envDir, { recursive: true });

    let confirmCalled = false;
    const result = await checkSafety({
      envDir,
      yes: false,
      log: () => {},
      confirm: async () => {
        confirmCalled = true;
        return true;
      },
    });

    expect(result).toBe("proceed");
    expect(confirmCalled).toBe(false);
  });

  it("returns 'proceed' when the manifest at envDir is malformed JSON", async () => {
    const envDir = join(workDir, "env");
    await mkdir(envDir, { recursive: true });
    await writeFile(join(envDir, ".manifest.json"), "{not json", "utf8");

    const result = await checkSafety({
      envDir,
      yes: false,
      log: () => {},
      confirm: async () => true,
    });

    expect(result).toBe("proceed");
  });
});
