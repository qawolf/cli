import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { manifestFilename, writeManifest } from "./io.js";
import { findFlowStamp } from "./lookup.js";
import type { Manifest } from "./types.js";

let workDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-lookup-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

async function stageEnv(
  envSlug: string,
  manifest: Manifest,
  files: { rel: string; content: string }[],
): Promise<string> {
  const envDir = join(workDir, ".qawolf", envSlug);
  await mkdir(envDir, { recursive: true });
  await writeManifest(envDir, manifest);
  for (const f of files) {
    const abs = join(envDir, f.rel);
    await mkdir(join(abs, ".."), { recursive: true });
    await writeFile(abs, f.content, "utf8");
  }
  return envDir;
}

const sampleManifest: Manifest = {
  envId: "env-abc",
  envSlug: undefined,
  fetchedAt: "2026-05-10T12:00:00.000Z",
  cliFlowsVersion: "0.1.0",
  qawolfCommitSha: undefined,
  qawolfCommittedAt: undefined,
  tagsFetchedAt: undefined,
  envVarsFetchedAt: undefined,
  flows: [
    { path: join("src", "login.flow.ts"), contentHash: "hash-login" },
    { path: "checkout.flow.ts", contentHash: "hash-checkout" },
  ],
};

describe("findFlowStamp", () => {
  it("returns the stamp for a flow listed in the manifest", async () => {
    const envDir = await stageEnv("staging", sampleManifest, [
      { rel: "src/login.flow.ts", content: "// login" },
    ]);
    const stamp = await findFlowStamp(join(envDir, "src/login.flow.ts"));
    expect(stamp).toEqual({
      envId: "env-abc",
      path: join("src", "login.flow.ts"),
      contentHash: "hash-login",
    });
  });

  it("matches a top-level flow with no subdirectory", async () => {
    const envDir = await stageEnv("staging", sampleManifest, [
      { rel: "checkout.flow.ts", content: "// checkout" },
    ]);
    const stamp = await findFlowStamp(join(envDir, "checkout.flow.ts"));
    expect(stamp?.path).toBe("checkout.flow.ts");
    expect(stamp?.contentHash).toBe("hash-checkout");
  });

  it("returns undefined when the flow is not under any .qawolf/<env>/", async () => {
    const loose = join(workDir, "outside.flow.ts");
    await writeFile(loose, "// outside", "utf8");
    expect(await findFlowStamp(loose)).toBeUndefined();
  });

  it("returns undefined when the manifest is missing", async () => {
    const envDir = join(workDir, ".qawolf", "staging");
    await mkdir(envDir, { recursive: true });
    const flow = join(envDir, "src/login.flow.ts");
    await mkdir(join(flow, ".."), { recursive: true });
    await writeFile(flow, "// login", "utf8");
    expect(await findFlowStamp(flow)).toBeUndefined();
  });

  it("returns undefined when the manifest is malformed", async () => {
    const envDir = join(workDir, ".qawolf", "staging");
    await mkdir(envDir, { recursive: true });
    await writeFile(join(envDir, manifestFilename), "{not json", "utf8");
    const flow = join(envDir, "x.flow.ts");
    await writeFile(flow, "// x", "utf8");
    expect(await findFlowStamp(flow)).toBeUndefined();
  });

  it("returns undefined when the flow file is not in the manifest's entries", async () => {
    const envDir = await stageEnv("staging", sampleManifest, [
      { rel: "untracked.flow.ts", content: "// untracked" },
    ]);
    expect(
      await findFlowStamp(join(envDir, "untracked.flow.ts")),
    ).toBeUndefined();
  });
});
