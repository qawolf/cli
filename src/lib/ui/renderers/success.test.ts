import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { makeClack } from "~/lib/ui/clack/styledClack.mock.js";
import { createSuccess } from "./success.js";

describe("createSuccess", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("human mode", () => {
    it("calls clack.log.success with the message", () => {
      const clack = makeClack();
      const success = createSuccess({ mode: "human", clack });

      success("Operation completed");

      expect(clack.log.success).toHaveBeenCalledWith("Operation completed");
    });
  });

  describe("json mode", () => {
    it("writes parseable JSON to stderr", () => {
      const clack = makeClack();
      const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
        () => true,
      );
      const success = createSuccess({ mode: "json", clack });

      success("Operation completed");

      expect(stderrSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: "success", message: "Operation completed" }) +
          "\n",
      );
      expect(clack.log.success).not.toHaveBeenCalled();
    });
  });

  describe("agent mode", () => {
    it("writes left-aligned message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
        () => true,
      );
      const success = createSuccess({ mode: "agent", clack });

      success("Operation completed");

      expect(stderrSpy).toHaveBeenCalledWith("Operation completed\n");
      expect(clack.log.success).not.toHaveBeenCalled();
    });
  });
});
