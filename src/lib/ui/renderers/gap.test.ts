import { afterEach, describe, expect, it, vi } from "vitest";

import { createGap } from "./gap.js";

describe("createGap", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("human mode", () => {
    it("writes newline to stderr", () => {
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const gap = createGap({ mode: "human" });

      gap();

      expect(stderrSpy).toHaveBeenCalledWith("\n");
    });
  });

  describe("json mode", () => {
    it("does not write anything", () => {
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const gap = createGap({ mode: "json" });

      gap();

      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  describe("agent mode", () => {
    it("writes newline to stderr", () => {
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const gap = createGap({ mode: "agent" });

      gap();

      expect(stderrSpy).toHaveBeenCalledWith("\n");
    });
  });
});
