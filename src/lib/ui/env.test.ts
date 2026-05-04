import { describe, expect, it } from "vitest";

import { detectOutputMode } from "./env.js";

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
});
