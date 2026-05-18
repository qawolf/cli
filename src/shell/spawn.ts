import { spawn } from "node:child_process";

export { spawn };

export type SpawnResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type SpawnFn = (cmd: string, args: string[]) => Promise<SpawnResult>;

export const defaultSpawn: SpawnFn = (cmd, args) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", () => resolve({ exitCode: -1, stdout, stderr }));
    child.on("close", (code) =>
      resolve({ exitCode: code ?? -1, stdout, stderr }),
    );
  });
