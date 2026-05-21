import { appendFile, appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import envPaths from "env-paths";

type LogLevel = "error" | "warn" | "info" | "debug" | "trace";
type LevelOrSilent = LogLevel | "silent";

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

export type LoggingSystemDeps = {
  appendFile?: (
    path: string,
    data: string,
    cb: (err?: NodeJS.ErrnoException) => void,
  ) => void;
  appendFileSync?: (path: string, data: string) => void;
  mkdirSync?: (path: string, opts: { recursive: boolean }) => void;
  stderr?: { write(chunk: string): unknown };
  processOn?: (event: "exit", listener: () => void) => void;
  setImmediate?: (fn: () => void) => void;
};

const levelValues: Record<LevelOrSilent, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

const fileThreshold = 4;

const levelLabels: Record<LogLevel, string> = {
  error: "ERROR",
  warn: "WARN ",
  info: "INFO ",
  debug: "DEBUG",
  trace: "TRACE",
};

export function defaultLogPath(): string {
  return envPaths("qawolf", { suffix: "" }).log + "/cli.log";
}

export function createLoggingSystem(
  opts: { stderrLevel: LevelOrSilent; logPath: string },
  deps?: LoggingSystemDeps,
): LoggingSystem {
  const { stderrLevel, logPath } = opts;
  const stderrThreshold = levelValues[stderrLevel];

  const _appendFile = deps?.appendFile ?? appendFile;
  const _appendFileSync = deps?.appendFileSync ?? appendFileSync;
  const _mkdirSync = deps?.mkdirSync ?? mkdirSync;
  const _processOn =
    deps?.processOn ?? ((event, listener) => process.on(event, listener));
  const _setImmediate = deps?.setImmediate ?? setImmediate;
  const stderr = deps?.stderr ?? process.stderr;

  const pending: string[] = [];
  let flushScheduled = false;
  let dirReady = false;

  const ensureDir = () => {
    if (dirReady) return;
    dirReady = true;
    try {
      _mkdirSync(dirname(logPath), { recursive: true });
    } catch {
      // ignore
    }
  };
  const flush = () => {
    if (pending.length === 0) return;
    const chunk = pending.splice(0).join("");
    ensureDir();
    try {
      _appendFileSync(logPath, chunk);
    } catch {
      // ignore
    }
  };
  const scheduleFlush = () => {
    if (flushScheduled) return;
    flushScheduled = true;
    _setImmediate(() => {
      flushScheduled = false;
      if (pending.length === 0) return;
      const chunk = pending.splice(0).join("");
      ensureDir();
      _appendFile(logPath, chunk, () => {});
    });
  };

  _processOn("exit", flush);

  return {
    flush,
    createLogger(scope: string): Logger {
      function log(level: LogLevel, msg: string): void {
        const val = levelValues[level];
        const line = `[${new Date().toISOString()}] [${levelLabels[level]}] [${scope}] ${msg}\n`;
        if (val >= 1 && val <= fileThreshold) {
          pending.push(line);
          scheduleFlush();
          if (stderrThreshold > 0 && val <= stderrThreshold) stderr.write(line);
          return;
        }
        if (val === 5 && stderrThreshold >= 5) stderr.write(line);
      }
      return {
        error: (msg) => log("error", msg),
        warn: (msg) => log("warn", msg),
        info: (msg) => log("info", msg),
        debug: (msg) => log("debug", msg),
        trace: (msg) => log("trace", msg),
      };
    },
  };
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
