import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { makeClack } from "~/shell/ui/clack/styledClack.mock.js";
import { createHumanRenderers } from "./human.js";

describe("human renderers", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("intro", () => {
    it("calls clack.intro with the title", () => {
      const clack = makeClack();
      createHumanRenderers(clack).intro("QA Wolf");
      expect(clack.intro).toHaveBeenCalledWith("QA Wolf");
    });
  });

  describe("note", () => {
    it("calls clack.note with message and title", () => {
      const clack = makeClack();
      createHumanRenderers(clack).note("API key loaded", "Authenticated");
      expect(clack.note).toHaveBeenCalledWith(
        "API key loaded",
        "Authenticated",
      );
    });

    it("calls clack.note with message only", () => {
      const clack = makeClack();
      createHumanRenderers(clack).note("Some detail");
      expect(clack.note).toHaveBeenCalledWith("Some detail", undefined);
    });
  });

  describe("outro", () => {
    it("calls clack.outro with the message", () => {
      const clack = makeClack();
      createHumanRenderers(clack).outro("All done!");
      expect(clack.outro).toHaveBeenCalledWith("All done!");
    });
  });

  describe("cancel", () => {
    it("calls clack.cancel with the message", () => {
      const clack = makeClack();
      createHumanRenderers(clack).cancel("Operation cancelled");
      expect(clack.cancel).toHaveBeenCalledWith("Operation cancelled");
    });
  });

  describe("step", () => {
    it("calls clack.log.step with the message", () => {
      const clack = makeClack();
      createHumanRenderers(clack).step("Fetching data");
      expect(clack.log.step).toHaveBeenCalledWith("Fetching data");
    });

    it("prefixes [current/total] when progress is supplied", () => {
      const clack = makeClack();
      createHumanRenderers(clack).step("Installing Chromium", {
        current: 1,
        total: 3,
      });
      expect(clack.log.step).toHaveBeenCalledWith("[1/3] Installing Chromium");
    });
  });

  describe("success", () => {
    it("calls clack.log.success with the message", () => {
      const clack = makeClack();
      createHumanRenderers(clack).success("Operation completed");
      expect(clack.log.success).toHaveBeenCalledWith("Operation completed");
    });
  });

  describe("warn", () => {
    it("calls clack.log.warn with the message", () => {
      const clack = makeClack();
      createHumanRenderers(clack).warn("Deprecated API");
      expect(clack.log.warn).toHaveBeenCalledWith("Deprecated API");
    });
  });

  describe("info", () => {
    it("calls clack.log.info with the message", () => {
      const clack = makeClack();
      createHumanRenderers(clack).info("Already configured");
      expect(clack.log.info).toHaveBeenCalledWith("Already configured");
    });
  });

  describe("error", () => {
    it("calls clack.log.error with title only", () => {
      const clack = makeClack();
      createHumanRenderers(clack).error("Something went wrong");
      expect(clack.log.error).toHaveBeenCalledWith("Something went wrong");
    });

    it("calls clack.log.error with title + newline + body", () => {
      const clack = makeClack();
      createHumanRenderers(clack).error(
        "Something went wrong",
        "Check your config.",
      );
      expect(clack.log.error).toHaveBeenCalledWith(
        "Something went wrong\nCheck your config.",
      );
    });
  });

  describe("output", () => {
    it("calls clack.log.info with humanMessage", () => {
      const clack = makeClack();
      createHumanRenderers(clack).output({ id: 1 }, "Operation succeeded");
      expect(clack.log.info).toHaveBeenCalledWith("Operation succeeded");
    });

    it("leaves urls plain when hyperlinks are unsupported", () => {
      const clack = makeClack();
      createHumanRenderers(clack, undefined, { hyperlinks: false }).output(
        { url: "https://app.qawolf.com/runs/rn1" },
        "url: https://app.qawolf.com/runs/rn1",
      );
      expect(clack.log.info).toHaveBeenCalledWith(
        "url: https://app.qawolf.com/runs/rn1",
      );
    });

    it("wraps urls in OSC 8 hyperlinks when supported", () => {
      const clack = makeClack();
      createHumanRenderers(clack, undefined, { hyperlinks: true }).output(
        { url: "https://app.qawolf.com/runs/rn1" },
        "url: https://app.qawolf.com/runs/rn1",
      );
      expect(clack.log.info).toHaveBeenCalledWith(
        "url: \x1b]8;;https://app.qawolf.com/runs/rn1\x07https://app.qawolf.com/runs/rn1\x1b]8;;\x07",
      );
    });
  });

  describe("gap", () => {
    it("writes newline to stderr", () => {
      const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
        () => true,
      );
      createHumanRenderers(makeClack()).gap();
      expect(stderrSpy).toHaveBeenCalledWith("\n");
    });
  });

  describe("write", () => {
    it("writes text to stdout", () => {
      const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(
        () => true,
      );
      createHumanRenderers(makeClack()).write("hello");
      expect(stdoutSpy).toHaveBeenCalledWith("hello");
    });
  });
});
