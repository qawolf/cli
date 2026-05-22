import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { makeClack } from "~/shell/ui/clack/styledClack.mock.js";
import { createJsonRenderers } from "./json.js";

function stderrSpy() {
  return spyOn(process.stderr, "write").mockImplementation(() => true);
}

function stdoutSpy() {
  return spyOn(process.stdout, "write").mockImplementation(() => true);
}

describe("json renderers", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("intro", () => {
    it("writes parseable JSON to stderr", () => {
      const spy = stderrSpy();
      createJsonRenderers().intro("QA Wolf");
      expect(spy).toHaveBeenCalledWith(
        JSON.stringify({ type: "intro", title: "QA Wolf" }) + "\n",
      );
    });
  });

  describe("note", () => {
    it("writes parseable JSON with title to stderr", () => {
      const spy = stderrSpy();
      createJsonRenderers().note("API key loaded", "Authenticated");
      expect(spy).toHaveBeenCalledWith(
        JSON.stringify({
          type: "note",
          title: "Authenticated",
          message: "API key loaded",
        }) + "\n",
      );
    });

    it("writes parseable JSON without title to stderr", () => {
      const spy = stderrSpy();
      createJsonRenderers().note("Some detail");
      expect(spy).toHaveBeenCalledWith(
        JSON.stringify({ type: "note", message: "Some detail" }) + "\n",
      );
    });
  });

  describe("outro", () => {
    it("writes parseable JSON to stderr", () => {
      const spy = stderrSpy();
      createJsonRenderers().outro("All done!");
      expect(spy).toHaveBeenCalledWith(
        JSON.stringify({ type: "outro", message: "All done!" }) + "\n",
      );
    });
  });

  describe("cancel", () => {
    it("writes parseable JSON to stderr", () => {
      const spy = stderrSpy();
      createJsonRenderers().cancel("Operation cancelled");
      expect(spy).toHaveBeenCalledWith(
        JSON.stringify({ type: "cancel", message: "Operation cancelled" }) +
          "\n",
      );
    });
  });

  describe("step", () => {
    it("writes parseable JSON to stderr", () => {
      const spy = stderrSpy();
      createJsonRenderers().step("Fetching data");
      expect(spy).toHaveBeenCalledWith(
        JSON.stringify({ type: "step", message: "Fetching data" }) + "\n",
      );
    });

    it("includes step and total when progress is supplied", () => {
      const spy = stderrSpy();
      createJsonRenderers().step("Installing Chromium", {
        current: 1,
        total: 3,
      });
      expect(spy).toHaveBeenCalledWith(
        JSON.stringify({
          type: "step",
          message: "Installing Chromium",
          step: 1,
          total: 3,
        }) + "\n",
      );
    });
  });

  describe("success", () => {
    it("writes parseable JSON to stderr", () => {
      const spy = stderrSpy();
      createJsonRenderers().success("Operation completed");
      expect(spy).toHaveBeenCalledWith(
        JSON.stringify({ type: "success", message: "Operation completed" }) +
          "\n",
      );
    });
  });

  describe("warn", () => {
    it("writes parseable JSON to stderr", () => {
      const spy = stderrSpy();
      createJsonRenderers().warn("Deprecated API");
      expect(spy).toHaveBeenCalledWith(
        JSON.stringify({ type: "warn", message: "Deprecated API" }) + "\n",
      );
    });
  });

  describe("info", () => {
    it("writes parseable JSON to stderr", () => {
      const spy = stderrSpy();
      createJsonRenderers().info("Already configured");
      expect(spy).toHaveBeenCalledWith(
        JSON.stringify({ type: "info", message: "Already configured" }) + "\n",
      );
    });
  });

  describe("error", () => {
    it("writes parseable JSON with body to stderr", () => {
      const spy = stderrSpy();
      createJsonRenderers().error("API error", "Invalid key.");
      expect(spy).toHaveBeenCalledWith(
        JSON.stringify({
          type: "error",
          title: "API error",
          body: "Invalid key.",
        }) + "\n",
      );
    });

    it("writes parseable JSON without body to stderr", () => {
      const spy = stderrSpy();
      createJsonRenderers().error("Network failure");
      expect(spy).toHaveBeenCalledWith(
        JSON.stringify({ type: "error", title: "Network failure" }) + "\n",
      );
    });
  });

  describe("output", () => {
    it("writes raw data as JSON to stdout, ignoring humanMessage", () => {
      const spy = stdoutSpy();
      const data = { id: 42, name: "test" };
      createJsonRenderers().output(data, "Ignored in json mode");
      expect(spy).toHaveBeenCalledWith(JSON.stringify(data) + "\n");
    });
  });

  describe("gap", () => {
    it("does not write anything", () => {
      const spy = stderrSpy();
      createJsonRenderers().gap();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("write", () => {
    it("does not write anything", () => {
      const stderr = stderrSpy();
      const stdout = stdoutSpy();
      createJsonRenderers().write("hello");
      expect(stderr).not.toHaveBeenCalled();
      expect(stdout).not.toHaveBeenCalled();
    });
  });

  describe("withProgress", () => {
    it("writes parseable JSON step and success lines to stderr without using clack spinner", async () => {
      const spy = stderrSpy();
      const clack = makeClack();
      const { withProgress } = createJsonRenderers();

      const results = await withProgress(
        [{ message: "verifying", task: async () => "ok" }],
        "done",
      );

      expect(results).toEqual(["ok"]);
      expect(spy).toHaveBeenCalledWith(
        JSON.stringify({
          type: "step",
          message: "verifying",
          step: 1,
          total: 1,
        }) + "\n",
      );
      expect(spy).toHaveBeenCalledWith(
        JSON.stringify({ type: "success", message: "done" }) + "\n",
      );
      expect(clack.spinner).not.toHaveBeenCalled();
    });
  });
});
