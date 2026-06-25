import { extractEmbeddedWorkerCli } from "./embeddedWorkerCli.js";

export type WorkerCommand = {
  command: string;
  prefixArgs: string[];
  // Extra env merged over process.env for the worker spawn; runs the compiled binary's worker as a normal Bun runtime via BUN_BE_BUN.
  env?: Record<string, string | undefined>;
};

/**
 * Resolves how to re-invoke this CLI as a worker subprocess. A compiled binary
 * with an embedded cli.js runs that bundle as a normal Bun runtime (BUN_BE_BUN)
 * so the worker resolves the flow's own node_modules — including native modules
 * like sharp — which the in-process compiled resolver cannot. Without an
 * embedded bundle (older binaries / tests), a compiled binary falls back to
 * invoking itself directly. Node/Bun running the bundle invoke the runtime with
 * the entry script as the first argument.
 */
export function resolveWorkerCommand(env: {
  execPath: string;
  scriptPath: string | undefined;
  compiled: boolean;
  workerCliPath: string | undefined;
}): WorkerCommand {
  if (env.compiled && env.workerCliPath !== undefined) {
    return {
      command: env.execPath,
      prefixArgs: [env.workerCliPath],
      env: { BUN_BE_BUN: "1" },
    };
  }
  if (env.compiled) return { command: env.execPath, prefixArgs: [] };
  if (env.scriptPath === undefined)
    throw new Error("Cannot resolve worker entrypoint: unknown script path");
  return { command: env.execPath, prefixArgs: [env.scriptPath] };
}

export function defaultWorkerCommand(): WorkerCommand {
  const compiled = process.env.QAWOLF_COMPILED === "true";
  return resolveWorkerCommand({
    execPath: process.execPath,
    scriptPath: process.argv[1],
    compiled,
    workerCliPath: compiled ? extractEmbeddedWorkerCli() : undefined,
  });
}
