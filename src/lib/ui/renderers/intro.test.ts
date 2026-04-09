import { afterEach, describe, expect, it, vi } from "vitest";

import { type StyledClack } from "../clack/index.js";
import { createIntro } from "./intro.js";

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

describe("createIntro", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("human mode", () => {
    it("calls clack.intro with the title", () => {
      const clack = makeClack();
      const intro = createIntro({ mode: "human", clack });

      intro("QA Wolf");

      expect(clack.intro).toHaveBeenCalledWith("QA Wolf");
    });
  });

  describe("json mode", () => {
    it("writes parseable JSON to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const intro = createIntro({ mode: "json", clack });

      intro("QA Wolf");

      expect(stderrSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: "intro", title: "QA Wolf" }) + "\n",
      );
      expect(clack.intro).not.toHaveBeenCalled();
    });
  });

  describe("agent mode", () => {
    it("writes left-aligned title to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const intro = createIntro({ mode: "agent", clack });

      intro("QA Wolf");

      expect(stderrSpy).toHaveBeenCalledWith("QA Wolf\n");
      expect(clack.intro).not.toHaveBeenCalled();
    });
  });
});
