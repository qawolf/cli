export type WorkerCommand = { command: string; prefixArgs: string[] };

/**
 * Resolves how to re-invoke this CLI as a worker subprocess. In a Bun
 * `--compile` binary, `process.execPath` is the qawolf binary itself, so it is
 * invoked directly. Otherwise (Node/Bun running the bundle) the runtime is
 * invoked with the entry script as its first argument.
 */
export function resolveWorkerCommand(env: {
  execPath: string;
  scriptPath: string | undefined;
  compiled: boolean;
}): WorkerCommand {
  if (env.compiled) return { command: env.execPath, prefixArgs: [] };
  if (env.scriptPath === undefined)
    throw new Error("Cannot resolve worker entrypoint: unknown script path");
  return { command: env.execPath, prefixArgs: [env.scriptPath] };
}
