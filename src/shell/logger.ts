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
  return envPaths("qawolf", { suffix: "" }).log + "/cli.log";
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
}): LoggingSystem {
  const { stderrLevel, logPath } = opts;

  const dest = pino.destination({ dest: logPath, mkdir: true, sync: false });
  const fileLogger = pino({ level: "debug" }, dest);
  const stderrLogger =
    stderrLevel !== "silent"
      ? pino({ level: stderrLevel }, process.stderr)
      : undefined;

  return {
    createLogger(scope: string): Logger {
      const file = fileLogger.child({ scope });
      const stderr = stderrLogger?.child({ scope });
      return {
        error: (msg) => {
          file.error(msg);
          stderr?.error(msg);
        },
        warn: (msg) => {
          file.warn(msg);
          stderr?.warn(msg);
        },
        info: (msg) => {
          file.info(msg);
          stderr?.info(msg);
        },
        debug: (msg) => {
          file.debug(msg);
          stderr?.debug(msg);
        },
        trace: (msg) => {
          file.trace(msg);
          stderr?.trace(msg);
        },
      };
    },
    flush() {
      dest.flushSync();
    },
  };
}
