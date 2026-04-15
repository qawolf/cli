import { afterEach, describe, expect, it, vi } from "vitest";

import { makeClack } from "~/lib/ui/clack/styledClack.mock.js";
import { createWarn } from "./warn.js";

describe("createWarn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("human mode", () => {
    it("calls clack.log.warn with the message", () => {
      const clack = makeClack();
      const warn = createWarn({ mode: "human", clack });

      warn("Deprecated API");

      expect(clack.log.warn).toHaveBeenCalledWith("Deprecated API");
    });
  });

  describe("json mode", () => {
    it("writes parseable JSON to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const warn = createWarn({ mode: "json", clack });

      warn("Deprecated API");

      expect(stderrSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: "warn", message: "Deprecated API" }) + "\n",
      );
      expect(clack.log.warn).not.toHaveBeenCalled();
    });
  });

  describe("agent mode", () => {
    it("writes left-aligned message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const warn = createWarn({ mode: "agent", clack });

      warn("Deprecated API");

      expect(stderrSpy).toHaveBeenCalledWith("Deprecated API\n");
      expect(clack.log.warn).not.toHaveBeenCalled();
    });
  });
});
