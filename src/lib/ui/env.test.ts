import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { detectOutputMode, isInteractive } from "./env.js";

describe("isInteractive", () => {
  const originalStdin = process.stdin.isTTY;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clean CI env vars so they don't interfere
    delete process.env["CI"];
    delete process.env["GITHUB_ACTIONS"];
    delete process.env["GITLAB_CI"];
    delete process.env["CIRCLECI"];
    delete process.env["JENKINS_URL"];
    delete process.env["BUILDKITE"];
  });

  afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: originalStdin,
      configurable: true,
      writable: true,
    });
    process.env = { ...originalEnv };
  });

  it("returns true when stdin is a TTY and not CI", () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      configurable: true,
      writable: true,
    });
    expect(isInteractive()).toBe(true);
  });

  it("returns false when stdin is not a TTY", () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect(isInteractive()).toBe(false);
  });

  it("returns false in CI even with TTY", () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      configurable: true,
      writable: true,
    });
    process.env["CI"] = "true";
    expect(isInteractive()).toBe(false);
  });

  it("returns false in GitHub Actions", () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      configurable: true,
      writable: true,
    });
    process.env["GITHUB_ACTIONS"] = "true";
    expect(isInteractive()).toBe(false);
  });
});

describe("detectOutputMode", () => {
  const originalStdout = process.stdout.isTTY;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env["CLAUDE_CODE"];
    delete process.env["CURSOR_SESSION_ID"];
    delete process.env["CI"];
    delete process.env["GITHUB_ACTIONS"];
    delete process.env["GITLAB_CI"];
    delete process.env["CIRCLECI"];
    delete process.env["JENKINS_URL"];
    delete process.env["BUILDKITE"];
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalStdout,
      configurable: true,
      writable: true,
    });
    process.env = { ...originalEnv };
  });

  it("returns json when --json flag is set", () => {
    expect(detectOutputMode({ json: true })).toBe("json");
  });

  it("returns agent when --agent flag is set", () => {
    expect(detectOutputMode({ agent: true })).toBe("agent");
  });

  it("returns agent when CLAUDE_CODE env is set", () => {
    process.env["CLAUDE_CODE"] = "1";
    expect(detectOutputMode({})).toBe("agent");
  });

  it("returns human when stdout is a TTY", () => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      configurable: true,
      writable: true,
    });
    expect(detectOutputMode({})).toBe("human");
  });

  it("returns json in CI even with TTY stdout", () => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      configurable: true,
      writable: true,
    });
    process.env["CI"] = "true";
    expect(detectOutputMode({})).toBe("json");
  });

  it("returns json when piped", () => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect(detectOutputMode({})).toBe("json");
  });

  it("json flag takes precedence over agent flag", () => {
    expect(detectOutputMode({ json: true, agent: true })).toBe("json");
  });
});
