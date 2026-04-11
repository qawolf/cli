import { afterEach, describe, expect, it, vi } from "vitest";

import { makeClack } from "../clack/styledClack.mock.js";
import { createOutput } from "./output.js";

describe("createOutput", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("human mode", () => {
    it("calls clack.log.info with humanMessage", () => {
      const clack = makeClack();
      const output = createOutput({ mode: "human", clack });

      output({ id: 1 }, "Operation succeeded");

      expect(clack.log.info).toHaveBeenCalledWith("Operation succeeded");
    });
  });

  describe("json mode", () => {
    it("writes JSON to stdout", () => {
      const clack = makeClack();
      const stdoutSpy = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      const output = createOutput({ mode: "json", clack });

      const data = { id: 42, name: "test" };
      output(data, "Ignored in json mode");

      expect(stdoutSpy).toHaveBeenCalledWith(JSON.stringify(data) + "\n");
    });
  });

  describe("agent mode", () => {
    it("writes left-aligned message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const output = createOutput({ mode: "agent", clack });

      output({ id: 1 }, "Operation succeeded");

      expect(stderrSpy).toHaveBeenCalledWith("Operation succeeded\n");
    });
  });
});
