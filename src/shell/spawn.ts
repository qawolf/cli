import { spawn } from "node:child_process";

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

export const defaultSpawn: SpawnFn = (cmd, args, opts) =>
  new Promise((resolve) => {
    const env = opts?.env ? { ...process.env, ...opts.env } : undefined;
    const child = spawn(cmd, args, env ? { env } : undefined);
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
