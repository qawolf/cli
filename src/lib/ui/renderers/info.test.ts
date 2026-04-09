import { afterEach, describe, expect, it, vi } from "vitest";

import { type StyledClack } from "../clack/index.js";
import { createInfo } from "./info.js";

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

describe("createInfo", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("human mode", () => {
    it("calls clack.log.info with the message", () => {
      const clack = makeClack();
      const info = createInfo({ mode: "human", clack });

      info("Already configured");

      expect(clack.log.info).toHaveBeenCalledWith("Already configured");
    });
  });

  describe("json mode", () => {
    it("writes message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const info = createInfo({ mode: "json", clack });

      info("Already configured");

      expect(stderrSpy).toHaveBeenCalledWith("  Already configured\n");
      expect(clack.log.info).not.toHaveBeenCalled();
    });
  });

  describe("agent mode", () => {
    it("writes message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const info = createInfo({ mode: "agent", clack });

      info("Already configured");

      expect(stderrSpy).toHaveBeenCalledWith("  Already configured\n");
      expect(clack.log.info).not.toHaveBeenCalled();
    });
  });
});
