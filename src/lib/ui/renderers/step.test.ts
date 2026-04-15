import { afterEach, describe, expect, it, vi } from "vitest";

import { makeClack } from "~/lib/ui/clack/styledClack.mock.js";
import { createStep } from "./step.js";

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
    it("writes parseable JSON to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const step = createStep({ mode: "json", clack });

      step("Fetching data");

      expect(stderrSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: "step", message: "Fetching data" }) + "\n",
      );
      expect(clack.log.step).not.toHaveBeenCalled();
    });
  });

  describe("agent mode", () => {
    it("writes left-aligned message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const step = createStep({ mode: "agent", clack });

      step("Fetching data");

      expect(stderrSpy).toHaveBeenCalledWith("Fetching data\n");
      expect(clack.log.step).not.toHaveBeenCalled();
    });
  });
});
