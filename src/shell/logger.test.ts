import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  createLoggingSystem,
  resolveStderrLevel,
  type LoggingSystemDeps,
} from "~/shell/logger.js";

afterEach(() => {
  mock.restore();
});

function makeDeps(overrides?: Partial<LoggingSystemDeps>): LoggingSystemDeps {
  return {
    appendFile: (_p, _d, cb) => {
      cb();
    },
    appendFileSync: () => {},
    mkdirSync: (_p, _opts) => {},
    processOn: () => {},
    setImmediate: () => {},
    stderr: { write: () => undefined },
    ...overrides,
  };
}

describe("logger", () => {
  it("should not write to stderr when stderrLevel is silent", () => {
    const captured: string[] = [];
    const deps = makeDeps({
      stderr: { write: (chunk) => captured.push(chunk) },
    });
    const system = createLoggingSystem(
      { stderrLevel: "silent", logPath: "/fake/test.log" },
      deps,
    );
    system.createLogger("test").debug("hello");
    expect(captured).toHaveLength(0);
  });

  it("should write to stderr when message level meets stderrLevel", () => {
    const captured: string[] = [];
    const deps = makeDeps({
      stderr: { write: (chunk) => captured.push(chunk) },
    });
    const system = createLoggingSystem(
      { stderrLevel: "debug", logPath: "/fake/test.log" },
      deps,
    );
    system.createLogger("scope").debug("hello");
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatch(/\[DEBUG\] \[scope\] hello\n$/);
  });

  it("should not write to stderr when message level is below stderrLevel threshold", () => {
    const captured: string[] = [];
    const deps = makeDeps({
      stderr: { write: (chunk) => captured.push(chunk) },
    });
    const system = createLoggingSystem(
      { stderrLevel: "warn", logPath: "/fake/test.log" },
      deps,
    );
    system.createLogger("test").debug("noisy");
    expect(captured).toHaveLength(0);
  });

  it("should format log line with timestamp, level label, scope, and message", () => {
    const captured: string[] = [];
    const deps = makeDeps({
      stderr: { write: (chunk) => captured.push(chunk) },
    });
    const system = createLoggingSystem(
      { stderrLevel: "debug", logPath: "/fake/test.log" },
      deps,
    );
    system.createLogger("api").warn("bad status");
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatch(
      /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[WARN \] \[api\] bad status\n$/,
    );
  });

  it("should enqueue a line for file transport and flush it synchronously via flush()", () => {
    const fileFlushed: string[] = [];
    const deps = makeDeps({
      appendFileSync: (_p, d) => fileFlushed.push(d),
    });
    const system = createLoggingSystem(
      { stderrLevel: "silent", logPath: "/fake/test.log" },
      deps,
    );
    system.createLogger("test").info("saved");
    system.flush();
    expect(fileFlushed).toHaveLength(1);
    expect(fileFlushed[0]).toContain("[INFO ]");
    expect(fileFlushed[0]).toContain("saved");
  });

  it("should not enqueue trace messages for file transport (file threshold is debug)", () => {
    const fileFlushed: string[] = [];
    const deps = makeDeps({
      appendFileSync: (_p, d) => fileFlushed.push(d),
    });
    const system = createLoggingSystem(
      { stderrLevel: "trace", logPath: "/fake/test.log" },
      deps,
    );
    system.createLogger("test").trace("verbose");
    system.flush();
    expect(fileFlushed).toHaveLength(0);
  });

  it("should register a flush handler on the exit event via processOn", () => {
    const registered: { event: string; listener: unknown }[] = [];
    const deps = makeDeps({
      processOn: (event, listener) => {
        registered.push({ event, listener });
      },
    });
    createLoggingSystem(
      { stderrLevel: "silent", logPath: "/fake/test.log" },
      deps,
    );
    expect(registered).toHaveLength(1);
    expect(registered[0]?.event).toBe("exit");
    expect(typeof registered[0]?.listener).toBe("function");
  });

  it('resolveStderrLevel should return "debug" when verbose is true', () => {
    expect(resolveStderrLevel({}, true)).toBe("debug");
  });

  it("resolveStderrLevel should return the env var value when QAWOLF_LOG_LEVEL is a valid level", () => {
    expect(resolveStderrLevel({ QAWOLF_LOG_LEVEL: "warn" }, false)).toBe(
      "warn",
    );
  });

  it('resolveStderrLevel should return "silent" for an unrecognized QAWOLF_LOG_LEVEL value', () => {
    expect(resolveStderrLevel({ QAWOLF_LOG_LEVEL: "verbose" }, false)).toBe(
      "silent",
    );
  });

  it('resolveStderrLevel should return "silent" when neither verbose nor env var is set', () => {
    expect(resolveStderrLevel({}, false)).toBe("silent");
  });
});
