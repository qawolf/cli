import { afterEach, describe, expect, it, vi } from "vitest";

import { type StyledClack } from "../clack/index.js";
import { formatCIError } from "./formatters/ci.js";
import { createError } from "./error.js";

function makeClack(): StyledClack {
  return {
    log: {
      info: vi.fn(),
      error: vi.fn(),
      step: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
    },
    intro: vi.fn(),
    note: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    password: vi.fn(),
    isCancel: vi.fn(),
    spinner: vi.fn(),
  } as unknown as StyledClack;
}

describe("createError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("human mode", () => {
    it("calls clack.log.error with title only", () => {
      const clack = makeClack();
      const error = createError({ mode: "human", clack });

      error("Something went wrong");

      expect(clack.log.error).toHaveBeenCalledWith("Something went wrong");
    });

    it("calls clack.log.error with title + newline + body", () => {
      const clack = makeClack();
      const error = createError({ mode: "human", clack });

      error("Something went wrong", "Check your config.");

      expect(clack.log.error).toHaveBeenCalledWith(
        "Something went wrong\nCheck your config.",
      );
    });
  });

  describe("json mode", () => {
    it("writes parseable JSON to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const error = createError({ mode: "json", clack });

      error("API error", "Invalid key.");

      expect(stderrSpy).toHaveBeenCalledWith(
        JSON.stringify({
          type: "error",
          title: "API error",
          body: "Invalid key.",
        }) + "\n",
      );
    });

    it("writes parseable JSON without body to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const error = createError({ mode: "json", clack });

      error("Network failure");

      expect(stderrSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: "error", title: "Network failure" }) + "\n",
      );
    });
  });

  describe("agent mode", () => {
    it("writes left-aligned formatted error to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const error = createError({ mode: "agent", clack });

      error("Network failure");

      expect(stderrSpy).toHaveBeenCalledWith(formatCIError("Network failure"));
    });
  });
});
