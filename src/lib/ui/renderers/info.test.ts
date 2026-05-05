import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { makeClack } from "~/lib/ui/clack/styledClack.mock.js";
import { createInfo } from "./info.js";

describe("createInfo", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("human mode", () => {
    it("calls clack.log.info with the message", () => {
      const clack = makeClack();
      const info = createInfo({ mode: "human", clack });

      info("Already configured");

      expect(clack.log.info).toHaveBeenCalledWith("Already configured");
    });
  });

  describe("json mode", () => {
    it("writes parseable JSON to stderr", () => {
      const clack = makeClack();
      const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
        () => true,
      );
      const info = createInfo({ mode: "json", clack });

      info("Already configured");

      expect(stderrSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: "info", message: "Already configured" }) + "\n",
      );
      expect(clack.log.info).not.toHaveBeenCalled();
    });
  });

  describe("agent mode", () => {
    it("writes left-aligned message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
        () => true,
      );
      const info = createInfo({ mode: "agent", clack });

      info("Already configured");

      expect(stderrSpy).toHaveBeenCalledWith("Already configured\n");
      expect(clack.log.info).not.toHaveBeenCalled();
    });
  });
});
