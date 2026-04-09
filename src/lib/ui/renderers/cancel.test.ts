import { afterEach, describe, expect, it, vi } from "vitest";

import { type StyledClack } from "../clack/index.js";
import { createCancel } from "./cancel.js";

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

describe("createCancel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("human mode", () => {
    it("calls clack.cancel with the message", () => {
      const clack = makeClack();
      const cancel = createCancel({ mode: "human", clack });

      cancel("Operation cancelled");

      expect(clack.cancel).toHaveBeenCalledWith("Operation cancelled");
    });
  });

  describe("json mode", () => {
    it("writes message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const cancel = createCancel({ mode: "json", clack });

      cancel("Operation cancelled");

      expect(stderrSpy).toHaveBeenCalledWith("  Operation cancelled\n");
      expect(clack.cancel).not.toHaveBeenCalled();
    });
  });

  describe("agent mode", () => {
    it("writes message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const cancel = createCancel({ mode: "agent", clack });

      cancel("Operation cancelled");

      expect(stderrSpy).toHaveBeenCalledWith("  Operation cancelled\n");
      expect(clack.cancel).not.toHaveBeenCalled();
    });
  });
});
