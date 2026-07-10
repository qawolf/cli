import { join } from "node:path";
import pino from "pino";
import envPaths from "env-paths";

type LevelOrSilent = "silent" | "error" | "warn" | "info" | "debug" | "trace";

export type Logger = {
  error(msg: string): void;
  warn(msg: string): void;
  info(msg: string): void;
  debug(msg: string): void;
  trace(msg: string): void;
};

export type LoggingSystem = {
  createLogger(scope: string): Logger;
  flush(): void;
};

export function defaultLogPath(): string {
  return join(envPaths("qawolf", { suffix: "" }).log, "cli.log");
}

export function resolveStderrLevel(
  env: Partial<Record<string, string>>,
  verbose: boolean,
): LevelOrSilent {
  if (verbose) return "debug";
  const raw = env["QAWOLF_LOG_LEVEL"];
  if (
    raw !== undefined &&
    ["error", "warn", "info", "debug", "trace", "silent"].includes(raw)
  )
    return raw as LevelOrSilent;
  return "silent";
}

export function createLoggingSystem(opts: {
  stderrLevel: LevelOrSilent;
  logPath: string;
  verboseWrite?: (level: string, scope: string, msg: string) => void;
}): LoggingSystem {
  const { stderrLevel, logPath } = opts;

  // sync so the fd opens at creation: with an async destination, a command
  // that errors before the fd opens (e.g. instant flag validation) crashes
  // pino's process-exit flush hook with "sonic boom is not ready yet".
  const dest = pino.destination({ dest: logPath, mkdir: true, sync: true });
  const fileLogger = pino({ level: "debug" }, dest);

  const levelNums = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60,
  } as const;
  const stderrLevelNum =
    stderrLevel === "silent" ? Infinity : (levelNums[stderrLevel] ?? Infinity);

  return {
    createLogger(scope: string): Logger {
      const file = fileLogger.child({ scope });
      return {
        error: (msg) => {
          file.error(msg);
          if (opts.verboseWrite && levelNums["error"] >= stderrLevelNum) {
            opts.verboseWrite("error", scope, msg);
          }
        },
        warn: (msg) => {
          file.warn(msg);
          if (opts.verboseWrite && levelNums["warn"] >= stderrLevelNum) {
            opts.verboseWrite("warn", scope, msg);
          }
        },
        info: (msg) => {
          file.info(msg);
          if (opts.verboseWrite && levelNums["info"] >= stderrLevelNum) {
            opts.verboseWrite("info", scope, msg);
          }
        },
        debug: (msg) => {
          file.debug(msg);
          if (opts.verboseWrite && levelNums["debug"] >= stderrLevelNum) {
            opts.verboseWrite("debug", scope, msg);
          }
        },
        trace: (msg) => {
          file.trace(msg);
          if (opts.verboseWrite && levelNums["trace"] >= stderrLevelNum) {
            opts.verboseWrite("trace", scope, msg);
          }
        },
      };
    },
    flush() {
      try {
        dest.flushSync();
      } catch {
        // Defensive: SonicBoom throws if the stream is destroyed or its fd
        // is somehow not open; nothing recoverable is buffered in that case.
      }
    },
  };
}
