// oxlint-disable eslint/max-lines -- fs injection added ~10 lines; extracting spawnPm would be premature
import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import { spawn as nodeSpawn } from "~/shell/spawn.js";
import { dirname, join } from "node:path";
import { flowsMessages } from "~/core/messages/index.js";
import {
  appiumUiautomator2DriverVersion,
  appiumVersion,
  appiumXcuitestDriverVersion,
  emailsVersion,
  flowsVersion,
  playwrightVersion,
  testkitVersion,
} from "~/generated/dependencyVersions.js";

// Walk up from a flow file to find its containing package root (the directory
// with the package.json that declares its dependencies).
export function findEnvDir(
  flowPath: string,
  fs: Fs = makeDefaultFs(),
): string | undefined {
  let dir = dirname(flowPath);
  while (true) {
    if (fs.existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

type PackageManager = "npm" | "bun" | "pnpm" | "yarn";

export function detectPackageManager(
  dir: string,
  fs: Fs = makeDefaultFs(),
): PackageManager {
  // bun.lockb = binary format (bun < 1.1); bun.lock = text format (bun ≥ 1.1, now default)
  if (
    fs.existsSync(join(dir, "bun.lockb")) ||
    fs.existsSync(join(dir, "bun.lock"))
  )
    return "bun";
  if (fs.existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(join(dir, "yarn.lock"))) return "yarn";
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

function readPkgJson(
  envDir: string,
  fs: Fs,
  ...parts: string[]
): Record<string, unknown> | undefined {
  try {
    return JSON.parse(
      fs.readFileSync(join(pkgDir(envDir, ...parts), "package.json")),
    ) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

// Returns the version field from an installed package's package.json.
function installedVersion(
  envDir: string,
  fs: Fs,
  ...parts: string[]
): string | undefined {
  const pkg = readPkgJson(envDir, fs, ...parts);
  const v = pkg?.["version"];
  return typeof v === "string" ? v : undefined;
}

// Returns the single envDir for all flow files, or undefined if none have a
// package.json ancestor. Throws if files span multiple packages.
export function resolveUniqueEnvDir(
  files: string[],
  fs: Fs = makeDefaultFs(),
): string | undefined {
  const dirs = new Set(
    files
      .map((f) => findEnvDir(f, fs))
      .filter((d): d is string => d !== undefined),
  );
  if (dirs.size > 1) {
    const listed = [...dirs].map((d) => `  - ${d}`).join("\n");
    throw new Error(
      flowsMessages.ensureDeps.multiPackagePattern(dirs.size, listed),
    );
  }
  return dirs.size === 1 ? [...dirs][0] : undefined;
}

const pinnedPackages: [string, string][] = [
  ["@qawolf/flows", flowsVersion],
  ["playwright", playwrightVersion],
  ["@qawolf/emails", emailsVersion],
  ["@qawolf/testkit", testkitVersion],
  ["appium", appiumVersion],
  ["appium-xcuitest-driver", appiumXcuitestDriverVersion],
  ["appium-uiautomator2-driver", appiumUiautomator2DriverVersion],
];

// Install all deps in the env directory, then ensure the CLI's external
// packages are present at the versions baked in at build time (see
// dependencyVersions.ts). This guarantees the env matches the CLI binary
// regardless of what the env's own package.json declares.
export async function ensureFlowDeps(
  envDir: string,
  fs: Fs = makeDefaultFs(),
): Promise<void> {
  const pm = detectPackageManager(envDir, fs);

  if (!fs.existsSync(pkgDir(envDir))) {
    const install = await spawnPm(pm, ["install"], envDir);
    if (install.exitCode !== 0) {
      throw new Error(
        flowsMessages.ensureDeps.installFailed(
          pm,
          envDir,
          install.stderr.trim(),
        ),
      );
    }
  }

  const needsInstall = pinnedPackages.some(
    ([pkg, ver]) => installedVersion(envDir, fs, ...pkg.split("/")) !== ver,
  );
  if (!needsInstall) return;

  // All pinned packages are installed in one command. npm replaces the entire
  // @qawolf/ scope directory on each sequential install, so batching prevents
  // a later @qawolf/* install from wiping an earlier one.
  const pkgSpecs = pinnedPackages.map(([pkg, ver]) => `${pkg}@${ver}`);
  const installCmd =
    pm === "npm" ? ["install", "--no-save", ...pkgSpecs] : ["add", ...pkgSpecs];
  const r = await spawnPm(pm, installCmd, envDir);
  if (r.exitCode !== 0) {
    throw new Error(
      flowsMessages.ensureDeps.installFailed(pm, envDir, r.stderr.trim()),
    );
  }
}
