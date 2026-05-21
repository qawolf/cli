import { describe, expect, it } from "bun:test";
import { resolveStderrLevel } from "~/shell/logger.js";

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
