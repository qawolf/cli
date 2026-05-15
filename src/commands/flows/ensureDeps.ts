import { spawn as nodeSpawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { flowsVersion, playwrightVersion } from "./flowsVersions.js";

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

type PackageManager = "npm" | "bun" | "pnpm" | "yarn";

export function detectPackageManager(dir: string): PackageManager {
  // bun.lockb = binary format (bun < 1.1); bun.lock = text format (bun ≥ 1.1, now default)
  if (existsSync(join(dir, "bun.lockb")) || existsSync(join(dir, "bun.lock")))
    return "bun";
  if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(dir, "yarn.lock"))) return "yarn";
  return "npm";
}

async function spawnPm(
  pm: PackageManager,
  args: string[],
  cwd: string,
): Promise<{ exitCode: number; stderr: string }> {
  // npm 7+ does strict peer-dep resolution by default, which rejects
  // peerOptional conflicts like @qawolf/flows vs. a project's pinned
  // playwright. --legacy-peer-deps reverts to npm 6 behaviour (warnings only).
  const resolvedArgs = pm === "npm" ? [...args, "--legacy-peer-deps"] : args;
  return new Promise((resolve) => {
    const child = nodeSpawn(pm, resolvedArgs, { cwd });
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

function addArgs(pm: PackageManager, pkg: string): string[] {
  return pm === "npm"
    ? ["install", "--save-exact", pkg]
    : ["add", "--save-exact", pkg];
}

function readPkgJson(
  envDir: string,
  ...parts: string[]
): Record<string, unknown> | undefined {
  try {
    return JSON.parse(
      readFileSync(join(pkgDir(envDir, ...parts), "package.json"), "utf8"),
    ) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

// Returns the version field from an installed package's package.json.
function installedVersion(
  envDir: string,
  ...parts: string[]
): string | undefined {
  const pkg = readPkgJson(envDir, ...parts);
  const v = pkg?.["version"];
  return typeof v === "string" ? v : undefined;
}

// Returns the single envDir for all flow files, or undefined if none have a
// package.json ancestor. Throws if files span multiple packages.
export function resolveUniqueEnvDir(files: string[]): string | undefined {
  const dirs = new Set(
    files.map(findEnvDir).filter((d): d is string => d !== undefined),
  );
  if (dirs.size > 1) {
    const listed = [...dirs].map((d) => `  - ${d}`).join("\n");
    throw new Error(
      `Pattern matches flows from ${dirs.size} packages — narrow it to a single package:\n${listed}\n\nHint: pass a pattern scoped to one package, e.g \`qawolf flows run '.qawolf/<env>/**'\`.`,
    );
  }
  return dirs.size === 1 ? [...dirs][0] : undefined;
}

// Install all deps in the env directory, then ensure @qawolf/flows and
// playwright are present at the versions the CLI requires. Both versions are
// baked in at build time (see flowsVersions.ts) so they match the CLI binary
// regardless of what the env's own package.json may declare.
export async function ensureFlowDeps(envDir: string): Promise<void> {
  const pm = detectPackageManager(envDir);

  if (!existsSync(pkgDir(envDir))) {
    const install = await spawnPm(pm, ["install"], envDir);
    if (install.exitCode !== 0) {
      throw new Error(
        `${pm} install failed in ${envDir}:\n${install.stderr.trim()}`,
      );
    }
  }

  if (installedVersion(envDir, "@qawolf", "flows") !== flowsVersion) {
    const r = await spawnPm(
      pm,
      addArgs(pm, `@qawolf/flows@${flowsVersion}`),
      envDir,
    );
    if (r.exitCode !== 0) {
      throw new Error(`${pm} add @qawolf/flows failed:\n${r.stderr.trim()}`);
    }
  }

  if (installedVersion(envDir, "playwright") !== playwrightVersion) {
    const r = await spawnPm(
      pm,
      addArgs(pm, `playwright@${playwrightVersion}`),
      envDir,
    );
    if (r.exitCode !== 0) {
      throw new Error(`${pm} add playwright failed:\n${r.stderr.trim()}`);
    }
  }
}
