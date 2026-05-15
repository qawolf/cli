import { spawn as nodeSpawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

// Walk up from a flow file to find its containing package root (the directory
// with the package.json that declares its dependencies).
export function findEnvDir(flowPath: string): string | undefined {
  let dir = dirname(flowPath);
  while (true) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

async function spawnNpm(
  args: string[],
  cwd: string,
): Promise<{ exitCode: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = nodeSpawn("npm", args, { cwd });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += String(chunk);
    });
    child.on("error", () => resolve({ exitCode: -1, stderr }));
    child.on("close", (code) => resolve({ exitCode: code ?? -1, stderr }));
  });
}

function pkgDir(envDir: string, ...pkgParts: string[]): string {
  return join(envDir, "node_modules", ...pkgParts);
}

// Install all deps in the env directory, then ensure playwright and
// @qawolf/flows are present — adding them via --no-save if not declared.
export async function ensureFlowDeps(envDir: string): Promise<void> {
  const install = await spawnNpm(["install"], envDir);
  if (install.exitCode !== 0) {
    throw new Error(
      `npm install failed in ${envDir}:\n${install.stderr.trim()}`,
    );
  }

  if (!existsSync(pkgDir(envDir, "playwright"))) {
    const r = await spawnNpm(["install", "--no-save", "playwright"], envDir);
    if (r.exitCode !== 0) {
      throw new Error(`npm install playwright failed:\n${r.stderr.trim()}`);
    }
  }

  if (!existsSync(pkgDir(envDir, "@qawolf", "flows"))) {
    const r = await spawnNpm(["install", "--no-save", "@qawolf/flows"], envDir);
    if (r.exitCode !== 0) {
      throw new Error(`npm install @qawolf/flows failed:\n${r.stderr.trim()}`);
    }
  }
}
