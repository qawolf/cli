import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import type { Fs } from "~/shell/fs.js";
import { manifestFilename } from "./io.js";
import { findPulledEnv, listPulledEnvDirs } from "./pulledEnv.js";

const cwd = "/proj";

const manifestFor = (
  envId: string,
  envSlug?: string,
  envName?: string,
): string =>
  JSON.stringify({
    envId,
    ...(envSlug === undefined ? {} : { envSlug }),
    ...(envName === undefined ? {} : { envName }),
    fetchedAt: "2026-09-01T12:00:00.000Z",
    cliFlowsVersion: "0.1.4",
    flows: [],
  });

async function fsWith(
  envs: { dir: string; envId: string; envSlug?: string; envName?: string }[],
): Promise<Fs> {
  const fs = makeMemoryFs();
  for (const e of envs) {
    await fs.mkdir(`${cwd}/.qawolf/${e.dir}`, { recursive: true });
    await fs.writeFile(
      `${cwd}/.qawolf/${e.dir}/${manifestFilename}`,
      manifestFor(e.envId, e.envSlug, e.envName),
    );
  }
  return fs;
}

const staging = { dir: "env-abc", envId: "env-abc", envSlug: "staging" };
const prod = { dir: "env-xyz", envId: "env-xyz", envSlug: "prod" };

describe("findPulledEnv", () => {
  it("matches the canonical id", async () => {
    const fs = await fsWith([staging, prod]);
    expect(await findPulledEnv("env-abc", cwd, fs)).toEqual({
      dir: join(cwd, ".qawolf", "env-abc"),
      envId: "env-abc",
    });
  });

  // The point of recording the slug: an alias is resolvable without the API.
  it("matches the slug recorded at pull time", async () => {
    const fs = await fsWith([staging, prod]);
    expect(await findPulledEnv("staging", cwd, fs)).toEqual({
      dir: join(cwd, ".qawolf", "env-abc"),
      envId: "env-abc",
    });
    expect(await findPulledEnv("prod", cwd, fs)).toEqual({
      dir: join(cwd, ".qawolf", "env-xyz"),
      envId: "env-xyz",
    });
  });

  // Labels shown to the user fall back to the display name when there is no
  // slug, so a name the CLI prints must also resolve.
  it("matches the display name recorded at pull time", async () => {
    const fs = await fsWith([
      { dir: "env-abc", envId: "env-abc", envName: "Staging" },
    ]);
    expect(await findPulledEnv("Staging", cwd, fs)).toEqual({
      dir: join(cwd, ".qawolf", "env-abc"),
      envId: "env-abc",
    });
  });

  it("returns the canonical id, not the slug, so the cache stays addressable", async () => {
    const fs = await fsWith([
      { dir: "env-abc", envId: "env-abc", envSlug: "staging" },
    ]);
    expect((await findPulledEnv("staging", cwd, fs))?.envId).toBe("env-abc");
  });

  it("is undefined for a name that matches nothing", async () => {
    const fs = await fsWith([staging]);
    expect(await findPulledEnv("nope", cwd, fs)).toBeUndefined();
  });

  it("is undefined when nothing has been pulled", async () => {
    expect(await findPulledEnv("staging", cwd, makeMemoryFs())).toBeUndefined();
  });

  // Manifests written before slugs were recorded still match by id, so an
  // older pulled env keeps working.
  it("still matches by id when the manifest predates slugs", async () => {
    const fs = await fsWith([{ dir: "env-abc", envId: "env-abc" }]);
    expect(await findPulledEnv("env-abc", cwd, fs)).toEqual({
      dir: join(cwd, ".qawolf", "env-abc"),
      envId: "env-abc",
    });
    expect(await findPulledEnv("staging", cwd, fs)).toBeUndefined();
  });

  it("ignores a directory whose manifest is unreadable", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir(`${cwd}/.qawolf/broken`, { recursive: true });
    await fs.writeFile(
      `${cwd}/.qawolf/broken/${manifestFilename}`,
      "{not json",
    );
    expect(await findPulledEnv("broken", cwd, fs)).toBeUndefined();
  });

  // An unreadable .qawolf is not the same answer as an absent one; reporting
  // "not found" would hide a permissions problem.
  it("rethrows a filesystem error that is not a missing directory", async () => {
    const fs = makeMemoryFs();
    const failing: Fs = {
      ...fs,
      readdirWithTypes: () => Promise.reject(new Error("EACCES: denied")),
    };

    expect(findPulledEnv("staging", cwd, failing)).rejects.toThrow("EACCES");
  });
});

describe("listPulledEnvDirs", () => {
  it("lists every directory holding a usable manifest", async () => {
    const fs = await fsWith([staging, prod]);
    expect(await listPulledEnvDirs(cwd, fs)).toEqual([
      join(cwd, ".qawolf", "env-abc"),
      join(cwd, ".qawolf", "env-xyz"),
    ]);
  });

  it("skips a directory whose manifest is unreadable", async () => {
    const fs = await fsWith([staging]);
    await fs.mkdir(`${cwd}/.qawolf/broken`, { recursive: true });
    await fs.writeFile(
      `${cwd}/.qawolf/broken/${manifestFilename}`,
      "{not json",
    );
    expect(await listPulledEnvDirs(cwd, fs)).toEqual([
      join(cwd, ".qawolf", "env-abc"),
    ]);
  });

  it("is empty when nothing has been pulled", async () => {
    expect(await listPulledEnvDirs(cwd, makeMemoryFs())).toEqual([]);
  });
});
