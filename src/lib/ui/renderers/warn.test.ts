import { afterEach, describe, expect, it, vi } from "vitest";

import { type StyledClack } from "../clack/index.js";
import { createWarn } from "./warn.js";

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

describe("createWarn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("human mode", () => {
    it("calls clack.log.warn with the message", () => {
      const clack = makeClack();
      const warn = createWarn({ mode: "human", clack });

      warn("Deprecated API");

      expect(clack.log.warn).toHaveBeenCalledWith("Deprecated API");
    });
  });

  describe("json mode", () => {
    it("writes message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const warn = createWarn({ mode: "json", clack });

      warn("Deprecated API");

      expect(stderrSpy).toHaveBeenCalledWith("  Deprecated API\n");
      expect(clack.log.warn).not.toHaveBeenCalled();
    });
  });

  describe("agent mode", () => {
    it("writes message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const warn = createWarn({ mode: "agent", clack });

      warn("Deprecated API");

      expect(stderrSpy).toHaveBeenCalledWith("  Deprecated API\n");
      expect(clack.log.warn).not.toHaveBeenCalled();
    });
  });
});
