import { afterEach, describe, expect, it, vi } from "vitest";

import { makeClack } from "../clack/styledClack.mock.js";
import { createCancel } from "./cancel.js";

describe("createCancel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("human mode", () => {
    it("calls clack.cancel with the message", () => {
      const clack = makeClack();
      const cancel = createCancel({ mode: "human", clack });

      cancel("Operation cancelled");

      expect(clack.cancel).toHaveBeenCalledWith("Operation cancelled");
    });
  });

  describe("json mode", () => {
    it("writes parseable JSON to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const cancel = createCancel({ mode: "json", clack });

      cancel("Operation cancelled");

      expect(stderrSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: "cancel", message: "Operation cancelled" }) +
          "\n",
      );
      expect(clack.cancel).not.toHaveBeenCalled();
    });
  });

  describe("agent mode", () => {
    it("writes left-aligned message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const cancel = createCancel({ mode: "agent", clack });

      cancel("Operation cancelled");

      expect(stderrSpy).toHaveBeenCalledWith("Operation cancelled\n");
      expect(clack.cancel).not.toHaveBeenCalled();
    });
  });
});
