import { afterEach, describe, expect, it, vi } from "vitest";

import { type StyledClack } from "../clack/index.js";
import { createStep } from "./step.js";

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

describe("createStep", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("human mode", () => {
    it("calls clack.log.step with the message", () => {
      const clack = makeClack();
      const step = createStep({ mode: "human", clack });

      step("Fetching data");

      expect(clack.log.step).toHaveBeenCalledWith("Fetching data");
    });
  });

  describe("json mode", () => {
    it("writes message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const step = createStep({ mode: "json", clack });

      step("Fetching data");

      expect(stderrSpy).toHaveBeenCalledWith("  Fetching data\n");
      expect(clack.log.step).not.toHaveBeenCalled();
    });
  });

  describe("agent mode", () => {
    it("writes message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const step = createStep({ mode: "agent", clack });

      step("Fetching data");

      expect(stderrSpy).toHaveBeenCalledWith("  Fetching data\n");
      expect(clack.log.step).not.toHaveBeenCalled();
    });
  });
});
