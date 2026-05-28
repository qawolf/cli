import { afterEach, describe, expect, it, mock } from "bun:test";
import { createLoggingSystem, resolveStderrLevel } from "~/shell/logger.js";

describe("resolveStderrLevel", () => {
  it('should return "debug" when verbose is true', () => {
    expect(resolveStderrLevel({}, true)).toBe("debug");
  });

  it("should return the env var value when QAWOLF_LOG_LEVEL is a valid level", () => {
    expect(resolveStderrLevel({ QAWOLF_LOG_LEVEL: "warn" }, false)).toBe(
      "warn",
    );
  });

  it('should return "silent" for an unrecognized QAWOLF_LOG_LEVEL value', () => {
    expect(resolveStderrLevel({ QAWOLF_LOG_LEVEL: "verbose" }, false)).toBe(
      "silent",
    );
  });

  it('should return "silent" when neither verbose nor env var is set', () => {
    expect(resolveStderrLevel({}, false)).toBe("silent");
  });
});

describe("createLoggingSystem — verboseWrite", () => {
  afterEach(() => {
    mock.restore();
  });

  it("should call verboseWrite when level meets stderrLevel threshold", () => {
    const verboseWrite = mock();
    const sys = createLoggingSystem({
      stderrLevel: "debug",
      logPath: "/dev/null",
      verboseWrite,
    });
    const logger = sys.createLogger("test-scope");
    logger.debug("hello");
    expect(verboseWrite).toHaveBeenCalledWith("debug", "test-scope", "hello");
  });

  it("should not call verboseWrite when level is below stderrLevel threshold", () => {
    const verboseWrite = mock();
    const sys = createLoggingSystem({
      stderrLevel: "info",
      logPath: "/dev/null",
      verboseWrite,
    });
    const logger = sys.createLogger("test-scope");
    logger.debug("hello");
    expect(verboseWrite).not.toHaveBeenCalled();
  });

  it("should not call verboseWrite when stderrLevel is silent", () => {
    const verboseWrite = mock();
    const sys = createLoggingSystem({
      stderrLevel: "silent",
      logPath: "/dev/null",
      verboseWrite,
    });
    const logger = sys.createLogger("test-scope");
    logger.error("hello");
    expect(verboseWrite).not.toHaveBeenCalled();
  });

  it("should not throw when verboseWrite is omitted", () => {
    const sys = createLoggingSystem({
      stderrLevel: "debug",
      logPath: "/dev/null",
    });
    const logger = sys.createLogger("test-scope");
    expect(() => logger.debug("hello")).not.toThrow();
  });
});
