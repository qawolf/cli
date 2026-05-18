import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { createGap } from "./gap.js";

describe("createGap", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("human mode", () => {
    it("writes newline to stderr", () => {
      const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
        () => true,
      );
      const gap = createGap({ mode: "human" });

      gap();

      expect(stderrSpy).toHaveBeenCalledWith("\n");
    });
  });

  describe("json mode", () => {
    it("does not write anything", () => {
      const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
        () => true,
      );
      const gap = createGap({ mode: "json" });

      gap();

      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  describe("agent mode", () => {
    it("writes newline to stderr", () => {
      const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
        () => true,
      );
      const gap = createGap({ mode: "agent" });

      gap();

      expect(stderrSpy).toHaveBeenCalledWith("\n");
    });
  });
});
