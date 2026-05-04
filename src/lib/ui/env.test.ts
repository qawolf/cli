import { describe, expect, it } from "vitest";

import { detectOutputMode, isInteractive } from "./env.js";

describe("isInteractive", () => {
  it("returns true when stdin is TTY and not in CI", () => {
    expect(isInteractive({ stdinIsTTY: true })).toBe(true);
  });

  it("returns false when stdin is TTY but in CI", () => {
    expect(isInteractive({ stdinIsTTY: true, env: { CI: "true" } })).toBe(
      false,
    );
  });

  it("returns false when stdin is not a TTY", () => {
    expect(isInteractive()).toBe(false);
  });
});

describe("detectOutputMode", () => {
  it("returns json when --json flag is set", () => {
    expect(detectOutputMode({ flags: { json: true } })).toBe("json");
  });

  it("returns agent when --agent flag is set", () => {
    expect(detectOutputMode({ flags: { agent: true } })).toBe("agent");
  });

  it("returns agent when CLAUDE_CODE env is set", () => {
    expect(detectOutputMode({ env: { CLAUDE_CODE: "1" } })).toBe("agent");
  });

  it("returns agent when CURSOR_SESSION_ID env is set", () => {
    expect(detectOutputMode({ env: { CURSOR_SESSION_ID: "abc" } })).toBe(
      "agent",
    );
  });

  it("returns human when stdout is a TTY", () => {
    expect(detectOutputMode({ stdoutIsTTY: true })).toBe("human");
  });

  it("returns json in CI even with TTY stdout", () => {
    expect(detectOutputMode({ env: { CI: "true" }, stdoutIsTTY: true })).toBe(
      "json",
    );
  });

  it("returns json in GitHub Actions even with TTY stdout", () => {
    expect(
      detectOutputMode({ env: { GITHUB_ACTIONS: "true" }, stdoutIsTTY: true }),
    ).toBe("json");
  });

  it("returns json when stdout is not a TTY", () => {
    expect(detectOutputMode()).toBe("json");
  });

  it("json flag takes precedence over agent flag", () => {
    expect(detectOutputMode({ flags: { json: true, agent: true } })).toBe(
      "json",
    );
  });

  it("agent flag takes precedence over CI env", () => {
    expect(
      detectOutputMode({ flags: { agent: true }, env: { CI: "true" } }),
    ).toBe("agent");
  });
});
