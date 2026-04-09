import { afterEach, describe, expect, it, vi } from "vitest";

import { type StyledClack } from "../clack/index.js";
import { createOutro } from "./outro.js";

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

describe("createOutro", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("human mode", () => {
    it("calls clack.outro with the message", () => {
      const clack = makeClack();
      const outro = createOutro({ mode: "human", clack });

      outro("All done!");

      expect(clack.outro).toHaveBeenCalledWith("All done!");
    });
  });

  describe("json mode", () => {
    it("writes message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const outro = createOutro({ mode: "json", clack });

      outro("All done!");

      expect(stderrSpy).toHaveBeenCalledWith("  All done!\n");
      expect(clack.outro).not.toHaveBeenCalled();
    });
  });

  describe("agent mode", () => {
    it("writes message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const outro = createOutro({ mode: "agent", clack });

      outro("All done!");

      expect(stderrSpy).toHaveBeenCalledWith("  All done!\n");
      expect(clack.outro).not.toHaveBeenCalled();
    });
  });
});
