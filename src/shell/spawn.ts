import { spawn, type SpawnOptions } from "node:child_process";

import { escapeArgument, escapeCommand } from "~/core/cmdEscape.js";

export { spawn };

export type SpawnResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

// platform is required so one call site decides both the command name and how
// the command is invoked. Pass the same platform that resolved cmd.
export type SpawnFn = (
  cmd: string,
  args: string[],
  opts: {
    platform: NodeJS.Platform;
    stdin?: string;
    env?: Record<string, string | undefined>;
  },
) => Promise<SpawnResult>;

// Node 18.20.2+/20.12.2+/24 refuses to execute .bat/.cmd files on win32 except
// through cmd.exe (CVE-2024-27980). Node 25 deprecates the shell:true route
// when the caller also passes an args array (DEP0190), so invoke cmd.exe here.
//
// SECURITY CONTRACT for callers spawning .cmd/.bat on win32:
//   Pass args as separate array elements, never concatenated into `cmd`.
//   ~/core/cmdEscape.js escapes them, so a meta character in a value cannot
//   inject a command. The target must forward its arguments with %*, which
//   the npm shims and the Android .bat launchers both do. Call sites today:
//   playwright.cmd, npm.cmd and appium.cmd with literal args. sdkmanager.bat
//   and avdmanager.bat take AVD names and system images from flow metadata in
//   the user's own repo. Audit any new .cmd/.bat caller before merging.
export function buildSpawnCommand(
  cmd: string,
  args: string[],
  platform: NodeJS.Platform,
  env: Record<string, string | undefined> | undefined,
): { cmd: string; args: string[]; options: SpawnOptions } {
  const options: SpawnOptions = {};
  if (env) options.env = env;
  if (platform !== "win32" || !/\.(cmd|bat)$/i.test(cmd)) {
    return { cmd, args, options };
  }
  const line = [escapeCommand(cmd), ...args.map(escapeArgument)].join(" ");
  return {
    cmd: process.env["ComSpec"] ?? "cmd.exe",
    args: ["/d", "/s", "/c", `"${line}"`],
    // args are already quoted; stop Node from quoting them again
    options: { ...options, windowsVerbatimArguments: true },
  };
}

export const defaultSpawn: SpawnFn = (cmd, args, opts) =>
  new Promise((resolve) => {
    const env = opts.env ? { ...process.env, ...opts.env } : undefined;
    const built = buildSpawnCommand(cmd, args, process.platform, env);
    const child = spawn(built.cmd, built.args, built.options);
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
