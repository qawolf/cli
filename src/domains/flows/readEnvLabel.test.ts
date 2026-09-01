import { describe, expect, it } from "bun:test";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { manifestFilename } from "~/shell/manifest/io.js";

import { readEnvLabel } from "./readEnvLabel.js";

const envDir = "/proj/.qawolf/env-abc";

async function fsWith(manifest: Record<string, unknown> | string) {
  const fs = makeMemoryFs();
  await fs.mkdir(envDir, { recursive: true });
  await fs.writeFile(
    `${envDir}/${manifestFilename}`,
    typeof manifest === "string" ? manifest : JSON.stringify(manifest),
  );
  return fs;
}

const base = {
  envId: "env-abc",
  fetchedAt: "2026-09-01T12:00:00.000Z",
  cliFlowsVersion: "0.1.4",
  flows: [],
};

describe("readEnvLabel", () => {
  it("prefers the slug", async () => {
    const fs = await fsWith({
      ...base,
      envSlug: "staging",
      envName: "Staging",
    });
    expect(await readEnvLabel(envDir, fs)).toBe("staging");
  });

  it("falls back to the display name", async () => {
    const fs = await fsWith({ ...base, envName: "Staging" });
    expect(await readEnvLabel(envDir, fs)).toBe("Staging");
  });

  // Environments pulled before slugs were recorded still get a usable label.
  it("falls back to the directory, which is the canonical id", async () => {
    const fs = await fsWith(base);
    expect(await readEnvLabel(envDir, fs)).toBe("env-abc");
  });

  it("falls back to the directory when the manifest is unreadable", async () => {
    const fs = await fsWith("{not json");
    expect(await readEnvLabel(envDir, fs)).toBe("env-abc");
  });
});
