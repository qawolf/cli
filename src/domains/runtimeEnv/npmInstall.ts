import { spawn as nodeSpawn } from "~/shell/spawn.js";

export type SpawnInstallResult = { exitCode: number; stderr: string };

/**
 * Runs `npm install --legacy-peer-deps` in the given directory and returns the
 * exit code and stderr. Uses the richer `stderr || err.message` fallback on
 * spawn error so callers always have diagnostic context.
 */
export function spawnNpmInstall(cwd: string): Promise<SpawnInstallResult> {
  return new Promise((resolve) => {
    // npm 7+ strict peer-dep resolution rejects peerOptional conflicts — revert to npm 6 behaviour.
    const child = nodeSpawn("npm", ["install", "--legacy-peer-deps"], { cwd });
    let stderr = "";
    // Drain stdout so a large install (playwright + appium) can't fill the pipe
    // buffer and stall npm; we only need the exit code and stderr.
    child.stdout?.resume();
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += String(chunk);
    });
    child.on("error", (err: Error) =>
      resolve({ exitCode: -1, stderr: stderr || err.message }),
    );
    child.on("close", (code) => resolve({ exitCode: code ?? -1, stderr }));
  });
}
