import { afterEach, describe, expect, it, vi } from "vitest";

import { makeClack } from "~/lib/ui/clack/styledClack.mock.js";
import { createNote } from "./note.js";

describe("createNote", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("human mode", () => {
    it("calls clack.note with message and title", () => {
      const clack = makeClack();
      const note = createNote({ mode: "human", clack });

      note("API key loaded", "Authenticated");

      expect(clack.note).toHaveBeenCalledWith(
        "API key loaded",
        "Authenticated",
      );
    });

    it("calls clack.note with message only", () => {
      const clack = makeClack();
      const note = createNote({ mode: "human", clack });

      note("Some detail");

      expect(clack.note).toHaveBeenCalledWith("Some detail", undefined);
    });
  });

  describe("json mode", () => {
    it("writes parseable JSON with title to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const note = createNote({ mode: "json", clack });

      note("API key loaded", "Authenticated");

      expect(stderrSpy).toHaveBeenCalledWith(
        JSON.stringify({
          type: "note",
          title: "Authenticated",
          message: "API key loaded",
        }) + "\n",
      );
      expect(clack.note).not.toHaveBeenCalled();
    });

    it("writes parseable JSON without title to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const note = createNote({ mode: "json", clack });

      note("Some detail");

      expect(stderrSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: "note", message: "Some detail" }) + "\n",
      );
      expect(clack.note).not.toHaveBeenCalled();
    });
  });

  describe("agent mode", () => {
    it("writes left-aligned title and message to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const note = createNote({ mode: "agent", clack });

      note("API key loaded", "Authenticated");

      expect(stderrSpy).toHaveBeenCalledWith("Authenticated: API key loaded\n");
      expect(clack.note).not.toHaveBeenCalled();
    });

    it("writes left-aligned message without title to stderr", () => {
      const clack = makeClack();
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const note = createNote({ mode: "agent", clack });

      note("Some detail");

      expect(stderrSpy).toHaveBeenCalledWith("Some detail\n");
      expect(clack.note).not.toHaveBeenCalled();
    });
  });
});
