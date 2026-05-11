import { spawn } from "node:child_process";

import type { SpawnFn } from "~/doctor/types.js";

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
