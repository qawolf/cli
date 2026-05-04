import { describe, expect, it } from "vitest";

import { detectOutputMode, isInteractive } from "./env.js";

describe("isInteractive", () => {
  it("returns true when stdin is TTY and not in CI", () => {
    expect(isInteractive(true, {})).toBe(true);
  });

  it("returns false when stdin is TTY but in CI", () => {
    expect(isInteractive(true, { CI: "true" })).toBe(false);
  });

  it("returns false when stdin is not a TTY", () => {
    expect(isInteractive(false, {})).toBe(false);
  });

  it("returns false when stdinIsTTY is undefined", () => {
    expect(isInteractive(undefined, {})).toBe(false);
  });
});

describe("detectOutputMode", () => {
  it("returns json when --json flag is set", () => {
    expect(detectOutputMode({ json: true }, {}, undefined)).toBe("json");
  });

  it("returns agent when --agent flag is set", () => {
    expect(detectOutputMode({ agent: true }, {}, undefined)).toBe("agent");
  });

  it("returns agent when CLAUDE_CODE env is set", () => {
    expect(detectOutputMode({}, { CLAUDE_CODE: "1" }, undefined)).toBe("agent");
  });

  it("returns agent when CURSOR_SESSION_ID env is set", () => {
    expect(detectOutputMode({}, { CURSOR_SESSION_ID: "abc" }, undefined)).toBe(
      "agent",
    );
  });

  it("returns human when stdout is a TTY", () => {
    expect(detectOutputMode({}, {}, true)).toBe("human");
  });

  it("returns json in CI even with TTY stdout", () => {
    expect(detectOutputMode({}, { CI: "true" }, true)).toBe("json");
  });

  it("returns json in GitHub Actions even with TTY stdout", () => {
    expect(detectOutputMode({}, { GITHUB_ACTIONS: "true" }, true)).toBe("json");
  });

  it("returns json when stdout is not a TTY", () => {
    expect(detectOutputMode({}, {}, undefined)).toBe("json");
  });

  it("json flag takes precedence over agent flag", () => {
    expect(detectOutputMode({ json: true, agent: true }, {}, undefined)).toBe(
      "json",
    );
  });

  it("agent flag takes precedence over CI env", () => {
    expect(detectOutputMode({ agent: true }, { CI: "true" }, undefined)).toBe(
      "agent",
    );
  });
});
