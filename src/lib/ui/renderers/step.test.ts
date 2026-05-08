import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { makeClack } from "~/lib/ui/clack/styledClack.mock.js";
import { createStep } from "./step.js";

describe("createStep", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("human mode", () => {
    it("calls clack.log.step with the message", () => {
      const clack = makeClack();
      const step = createStep({ mode: "human", clack });

      step("Fetching data");

      expect(clack.log.step).toHaveBeenCalledWith("Fetching data");
    });

    it("prefixes [current/total] when progress is supplied", () => {
      const clack = makeClack();
      const step = createStep({ mode: "human", clack });

      step("Installing Chromium", { current: 1, total: 3 });

      expect(clack.log.step).toHaveBeenCalledWith("[1/3] Installing Chromium");
    });
  });

  describe("json mode", () => {
    it("writes parseable JSON to stderr", () => {
      const clack = makeClack();
      const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
        () => true,
      );
      const step = createStep({ mode: "json", clack });

      step("Fetching data");

      expect(stderrSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: "step", message: "Fetching data" }) + "\n",
      );
      expect(clack.log.step).not.toHaveBeenCalled();
    });

    it("includes step and total as structured fields when progress is supplied", () => {
      const clack = makeClack();
      const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
        () => true,
      );
      const step = createStep({ mode: "json", clack });

      step("Installing Chromium", { current: 1, total: 3 });

      expect(stderrSpy).toHaveBeenCalledWith(
        JSON.stringify({
          type: "step",
          message: "Installing Chromium",
          step: 1,
          total: 3,
        }) + "\n",
      );
    });
  });

  describe("agent mode", () => {
    it("writes left-aligned message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
        () => true,
      );
      const step = createStep({ mode: "agent", clack });

      step("Fetching data");

      expect(stderrSpy).toHaveBeenCalledWith("Fetching data\n");
      expect(clack.log.step).not.toHaveBeenCalled();
    });

    it("prefixes [current/total] when progress is supplied", () => {
      const clack = makeClack();
      const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
        () => true,
      );
      const step = createStep({ mode: "agent", clack });

      step("Installing Chromium", { current: 1, total: 3 });

      expect(stderrSpy).toHaveBeenCalledWith("[1/3] Installing Chromium\n");
    });
  });
});
