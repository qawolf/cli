import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { makeEnvVarDeps } from "./envVarDeps.js";

type EnvVarRuntimeDeps = {
  setEnvironmentVariable: (key: string, value: string) => Promise<void>;
  fetchLatestEnvironmentVariables: () => Promise<void>;
};

function makeDeps(envDir: string): {
  fs: ReturnType<typeof makeMemoryFs>;
  deps: EnvVarRuntimeDeps;
} {
  const fs = makeMemoryFs();
  return { fs, deps: makeEnvVarDeps(envDir, fs) as EnvVarRuntimeDeps };
}

describe("makeEnvVarDeps", () => {
  it("persists setEnvironmentVariable to the env .env and process.env", async () => {
    const envDir = "/env";
    const { fs, deps } = makeDeps(envDir);
    await fs.mkdir(envDir, { recursive: true });

    await deps.setEnvironmentVariable("TOKEN", "abc");

    expect(await fs.readFile(join(envDir, ".env"))).toBe('TOKEN="abc"\n');
    expect(process.env["TOKEN"]).toBe("abc");
    delete process.env["TOKEN"];
  });

  it("persists keys that need quoting instead of silently dropping them", async () => {
    const envDir = "/env";
    const { fs, deps } = makeDeps(envDir);
    await fs.mkdir(envDir, { recursive: true });

    await deps.setEnvironmentVariable("DOTTED.KEY", "abc");

    expect(await fs.readFile(join(envDir, ".env"))).toBe(
      '"DOTTED.KEY"="abc"\n',
    );
    expect(process.env["DOTTED.KEY"]).toBe("abc");
    delete process.env["DOTTED.KEY"];
  });

  it("does not swallow malformed .env content", async () => {
    const envDir = "/env";
    const { fs, deps } = makeDeps(envDir);
    await fs.mkdir(envDir, { recursive: true });
    await fs.writeFile(join(envDir, ".env"), "not valid\n");

    let caught: unknown;
    try {
      await deps.fetchLatestEnvironmentVariables();
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/Cannot parse/i);
  });
});
