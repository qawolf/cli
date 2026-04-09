import { afterEach, describe, expect, it, vi } from "vitest";

import { type StyledClack } from "../clack/index.js";
import { createSuccess } from "./success.js";

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

describe("createSuccess", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("human mode", () => {
    it("calls clack.log.success with the message", () => {
      const clack = makeClack();
      const success = createSuccess({ mode: "human", clack });

      success("Operation completed");

      expect(clack.log.success).toHaveBeenCalledWith("Operation completed");
    });
  });

  describe("json mode", () => {
    it("writes parseable JSON to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const success = createSuccess({ mode: "json", clack });

      success("Operation completed");

      expect(stderrSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: "success", message: "Operation completed" }) +
          "\n",
      );
      expect(clack.log.success).not.toHaveBeenCalled();
    });
  });

  describe("agent mode", () => {
    it("writes left-aligned message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const success = createSuccess({ mode: "agent", clack });

      success("Operation completed");

      expect(stderrSpy).toHaveBeenCalledWith("Operation completed\n");
      expect(clack.log.success).not.toHaveBeenCalled();
    });
  });
});
