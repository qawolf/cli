import { spawn, type SpawnOptions } from "node:child_process";

export { spawn };

export type SpawnResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type SpawnFn = (
  cmd: string,
  args: string[],
  opts?: { stdin?: string; env?: Record<string, string | undefined> },
) => Promise<SpawnResult>;

// Node 18.20.2+/20.12.2+/24 refuses to execute .bat/.cmd files on win32
// unless shell:true is set (CVE-2024-27980). With shell:true, Node routes
// through cmd.exe /d /s /c and applies its own arg-quoting — the path the
// CVE fix is designed to make safe.
//
// SECURITY CONTRACT for callers spawning .cmd/.bat on win32:
//   Do not pass attacker-controlled values in `cmd` or `args`. Node's
//   cmd.exe escaping protects against shell-metacharacter injection in
//   args, but only when those args are passed as separate array elements
//   (never concatenated into `cmd`). Today the call sites are playwright.cmd
//   (browser names, --version) and npm.cmd (install, ping), all literal args;
//   audit any new .cmd/.bat caller before merging.
export function buildSpawnOptions(
  cmd: string,
  platform: NodeJS.Platform,
  env: Record<string, string | undefined> | undefined,
): SpawnOptions {
  const opts: SpawnOptions = {};
  if (env) opts.env = env;
  if (platform === "win32" && /\.(cmd|bat)$/i.test(cmd)) opts.shell = true;
  return opts;
}

export const defaultSpawn: SpawnFn = (cmd, args, opts) =>
  new Promise((resolve) => {
    const env = opts?.env ? { ...process.env, ...opts.env } : undefined;
    const child = spawn(
      cmd,
      args,
      buildSpawnOptions(cmd, process.platform, env),
    );
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    if (opts?.stdin !== undefined) {
      child.stdin?.write(opts.stdin);
      child.stdin?.end();
    }
    child.on("error", (err) =>
      resolve({ exitCode: -1, stdout, stderr: stderr || err.message }),
    );
    child.on("close", (code) =>
      resolve({ exitCode: code ?? -1, stdout, stderr }),
    );
  });
