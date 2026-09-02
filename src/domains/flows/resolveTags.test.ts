import { afterEach, describe, expect, it, mock } from "bun:test";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import type { AuthCommandContext } from "~/shell/commandContext.js";
import { makeCtx as makeBaseCtx } from "~/shell/commandContext.testUtils.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import type { Fs } from "~/shell/fs.js";
import { manifestFilename } from "~/shell/manifest/io.js";
import type { Manifest } from "~/shell/manifest/types.js";
import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";

import { resolveTags } from "./resolveTags.js";

afterEach(() => {
  mock.restore();
});

const envDir = "/proj/.qawolf/staging";

const liveOk = () =>
  makeCallPublicApiMock().mockResolvedValue({
    ok: true,
    value: {
      flows: [{ flowId: "f1", path: "src/flows/a.flow.ts", tags: ["auth"] }],
    },
  });

function makeCtx(
  callPublicApi: ReturnType<typeof makeCallPublicApiMock>,
): AuthCommandContext {
  return {
    ...makeBaseCtx("json"),
    apiKeySource: "env",
    platformClient: makeMockPlatformClient({ callPublicApi }),
  } as unknown as AuthCommandContext;
}

async function fsWithManifest(over: Partial<Manifest>): Promise<Fs> {
  const fs = makeMemoryFs();
  await fs.mkdir(envDir, { recursive: true });
  const manifest: Manifest = {
    envId: "env-1",
    envSlug: undefined,
    envName: undefined,
    fetchedAt: "2026-05-01T12:00:00.000Z",
    envVarsFetchedAt: undefined,
    cliFlowsVersion: "0.1.0",
    qawolfCommitSha: undefined,
    qawolfCommittedAt: undefined,
    tagsFetchedAt: "2026-05-01T12:00:00.000Z",
    flows: [
      { path: "src/flows/a.flow.ts", contentHash: "h1", tags: ["cached-tag"] },
    ],
    ...over,
  };
  await fs.writeFile(`${envDir}/${manifestFilename}`, JSON.stringify(manifest));
  return fs;
}

describe("resolveTags live", () => {
  it("asks the platform for the env's flows including drafts", async () => {
    const callPublicApi = liveOk();

    await resolveTags(makeCtx(callPublicApi), "env-1", envDir, makeMemoryFs());

    expect(callPublicApi).toHaveBeenCalledWith(publicContractsV1.flow.list, {
      environmentId: "env-1",
      includeDrafts: true,
    });
  });

  it("returns live tags without touching the cache", async () => {
    const result = await resolveTags(
      makeCtx(liveOk()),
      "env-1",
      envDir,
      await fsWithManifest({}),
    );

    expect(result.kind).toBe("live");
    if (result.kind === "unavailable") throw new Error("expected tags");
    expect(result.byPath.get("src/flows/a.flow.ts")).toEqual(["auth"]);
  });
});

describe("resolveTags fallback", () => {
  const liveFails = () =>
    makeCallPublicApiMock().mockResolvedValue({ ok: false, error: "HTTP 503" });

  it("falls back to the cached tags and reports when they were fetched", async () => {
    const result = await resolveTags(
      makeCtx(liveFails()),
      "env-1",
      envDir,
      await fsWithManifest({}),
    );

    expect(result.kind).toBe("cached");
    if (result.kind !== "cached") throw new Error("expected cached tags");
    expect(result.fetchedAt).toBe("2026-05-01T12:00:00.000Z");
    expect(result.byPath.get("src/flows/a.flow.ts")).toEqual(["cached-tag"]);
  });

  it("falls back when the live call throws", async () => {
    const result = await resolveTags(
      makeCtx(makeCallPublicApiMock().mockRejectedValue(new Error("offline"))),
      "env-1",
      envDir,
      await fsWithManifest({}),
    );

    expect(result.kind).toBe("cached");
  });

  // A manifest with no tagsFetchedAt predates tags entirely, so there is
  // nothing to fall back to and the caller must not match zero flows quietly.
  it("is unavailable when the manifest never fetched tags", async () => {
    const result = await resolveTags(
      makeCtx(liveFails()),
      "env-1",
      envDir,
      await fsWithManifest({ tagsFetchedAt: undefined }),
    );

    expect(result.kind).toBe("unavailable");
  });

  it("is unavailable when there is no manifest at all", async () => {
    const result = await resolveTags(
      makeCtx(liveFails()),
      "env-1",
      envDir,
      makeMemoryFs(),
    );

    expect(result.kind).toBe("unavailable");
  });

  it("omits a cached flow whose tags were never recorded", async () => {
    const result = await resolveTags(
      makeCtx(liveFails()),
      "env-1",
      envDir,
      await fsWithManifest({
        flows: [
          { path: "src/flows/a.flow.ts", contentHash: "h1", tags: undefined },
        ],
      }),
    );

    if (result.kind !== "cached") throw new Error("expected cached tags");
    expect(result.byPath.has("src/flows/a.flow.ts")).toBe(false);
  });

  // Manifests written by an older CLI on win32 hold `\` paths; lookups are
  // posix repo-relative, so the cache must normalize to stay usable.
  it("keys cached tags on posix form even when the manifest used backslashes", async () => {
    const result = await resolveTags(
      makeCtx(liveFails()),
      "env-1",
      envDir,
      await fsWithManifest({
        flows: [
          {
            path: "src\\flows\\a.flow.ts",
            contentHash: "h1",
            tags: ["cached-tag"],
          },
        ],
      }),
    );

    if (result.kind !== "cached") throw new Error("expected cached tags");
    expect(result.byPath.get("src/flows/a.flow.ts")).toEqual(["cached-tag"]);
  });
});
