import { spawn } from "node:child_process";

export type SpawnCliResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type SpawnCliOptions = {
  readonly cwd: string;
  readonly env: Record<string, string | undefined>;
  // SIGKILL the child after this many ms — guards against a hung CLI or stalled
  // browser download wedging the whole matrix with no diagnostic.
  readonly timeoutMs?: number;
};

/**
 * Minimal promise wrapper over node:child_process spawn. Captures exit code and
 * decoded stdout/stderr; never rejects — a spawn error (including a timeout
 * kill) resolves with exitCode -1 so callers branch on the result instead of
 * try/catch.
 */
export function spawnCli(
  command: string,
  args: readonly string[],
  options: SpawnCliOptions,
): Promise<SpawnCliResult> {
  return new Promise((resolve) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env,
      timeout: options.timeoutMs,
      killSignal: "SIGKILL",
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) =>
      resolve({ exitCode: -1, stdout, stderr: stderr || error.message }),
    );
    child.on("close", (code) =>
      resolve({ exitCode: code ?? -1, stdout, stderr }),
    );
  });
}
