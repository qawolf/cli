import { afterEach, describe, expect, it, vi } from "vitest";

import { makeClack } from "~/lib/ui/clack/styledClack.mock.js";
import { createOutro } from "./outro.js";

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
    it("writes parseable JSON to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const outro = createOutro({ mode: "json", clack });

      outro("All done!");

      expect(stderrSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: "outro", message: "All done!" }) + "\n",
      );
      expect(clack.outro).not.toHaveBeenCalled();
    });
  });

  describe("agent mode", () => {
    it("writes left-aligned message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const outro = createOutro({ mode: "agent", clack });

      outro("All done!");

      expect(stderrSpy).toHaveBeenCalledWith("All done!\n");
      expect(clack.outro).not.toHaveBeenCalled();
    });
  });
});
