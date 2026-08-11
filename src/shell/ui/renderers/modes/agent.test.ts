import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { makeClack } from "~/shell/ui/clack/styledClack.mock.js";
import { formatCIError } from "../formatters/ci.js";
import { createAgentRenderers } from "./agent.js";

function stderrSpy() {
  return spyOn(process.stderr, "write").mockImplementation(() => true);
}

function stdoutSpy() {
  return spyOn(process.stdout, "write").mockImplementation(() => true);
}

describe("agent renderers", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("intro", () => {
    it("writes left-aligned title to stderr", () => {
      const spy = stderrSpy();
      createAgentRenderers().intro("QA Wolf");
      expect(spy).toHaveBeenCalledWith("QA Wolf\n");
    });
  });

  describe("note", () => {
    it("writes 'title: message' to stderr", () => {
      const spy = stderrSpy();
      createAgentRenderers().note("API key loaded", "Authenticated");
      expect(spy).toHaveBeenCalledWith("Authenticated: API key loaded\n");
    });

    it("writes message only when title omitted", () => {
      const spy = stderrSpy();
      createAgentRenderers().note("Some detail");
      expect(spy).toHaveBeenCalledWith("Some detail\n");
    });
  });

  describe("outro", () => {
    it("writes message to stderr", () => {
      const spy = stderrSpy();
      createAgentRenderers().outro("All done!");
      expect(spy).toHaveBeenCalledWith("All done!\n");
    });
  });

  describe("cancel", () => {
    it("writes message to stderr", () => {
      const spy = stderrSpy();
      createAgentRenderers().cancel("Operation cancelled");
      expect(spy).toHaveBeenCalledWith("Operation cancelled\n");
    });
  });

  describe("step", () => {
    it("writes message to stderr", () => {
      const spy = stderrSpy();
      createAgentRenderers().step("Fetching data");
      expect(spy).toHaveBeenCalledWith("Fetching data\n");
    });

    it("prefixes [current/total] when progress is supplied", () => {
      const spy = stderrSpy();
      createAgentRenderers().step("Installing Chromium", {
        current: 1,
        total: 3,
      });
      expect(spy).toHaveBeenCalledWith("[1/3] Installing Chromium\n");
    });
  });

  describe("success", () => {
    it("writes message to stderr", () => {
      const spy = stderrSpy();
      createAgentRenderers().success("Operation completed");
      expect(spy).toHaveBeenCalledWith("Operation completed\n");
    });
  });

  describe("warn", () => {
    it("writes message to stderr", () => {
      const spy = stderrSpy();
      createAgentRenderers().warn("Deprecated API");
      expect(spy).toHaveBeenCalledWith("Deprecated API\n");
    });
  });

  describe("info", () => {
    it("writes message to stderr", () => {
      const spy = stderrSpy();
      createAgentRenderers().info("Already configured");
      expect(spy).toHaveBeenCalledWith("Already configured\n");
    });
  });

  describe("error", () => {
    it("writes formatCIError output to stderr", () => {
      const spy = stderrSpy();
      createAgentRenderers().error("Network failure");
      expect(spy).toHaveBeenCalledWith(formatCIError("Network failure"));
    });
  });

  describe("output", () => {
    it("writes data as a JSON line to stdout and humanMessage to stderr", () => {
      const stdout = stdoutSpy();
      const stderr = stderrSpy();
      const data = { id: 1 };
      createAgentRenderers().output(data, "Operation succeeded");
      expect(stdout).toHaveBeenCalledWith(JSON.stringify(data) + "\n");
      expect(stderr).toHaveBeenCalledWith("Operation succeeded\n");
    });
  });

  describe("gap", () => {
    it("writes newline to stderr", () => {
      const spy = stderrSpy();
      createAgentRenderers().gap();
      expect(spy).toHaveBeenCalledWith("\n");
    });
  });

  describe("write", () => {
    it("writes raw text to stderr", () => {
      const spy = stderrSpy();
      createAgentRenderers().write("hello");
      expect(spy).toHaveBeenCalledWith("hello");
    });
  });

  describe("withProgress", () => {
    it("writes left-aligned progress and final message to stderr without using clack spinner", async () => {
      const spy = stderrSpy();
      const clack = makeClack();
      const { withProgress } = createAgentRenderers();

      const results = await withProgress(
        [
          { message: "verifying", task: async () => "ok" },
          { message: "storing", task: async () => "saved" },
        ],
        "All done!",
      );

      expect(results).toEqual(["ok", "saved"]);
      expect(spy).toHaveBeenCalledWith("[1/2] verifying\n");
      expect(spy).toHaveBeenCalledWith("[2/2] storing\n");
      expect(spy).toHaveBeenCalledWith("All done!\n");
      expect(clack.spinner).not.toHaveBeenCalled();
    });

    it("writes a stderr line when a task reports progress", async () => {
      const spy = stderrSpy();
      const { withProgress } = createAgentRenderers();

      await withProgress(
        [
          {
            message: "Downloading assets",
            task: async (update) => {
              update("Downloading assets (1/2)");
            },
          },
        ],
        "done",
      );

      expect(spy).toHaveBeenCalledWith("[1/1] Downloading assets (1/2)\n");
    });
  });
});
