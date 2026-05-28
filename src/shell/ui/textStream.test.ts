import { describe, expect, it, mock } from "bun:test";

import { makeFakeUI } from "~/shell/commandContext.testUtils.js";

import { createTextStream } from "./textStream.js";

function makeCapturingUI() {
  const writes: string[] = [];
  const ui = {
    ...makeFakeUI(),
    write: mock((text: string) => {
      writes.push(text);
    }),
  };
  return { ui, writes };
}

describe("createTextStream", () => {
  describe("endTimeline", () => {
    it("calls ui.outro with the message", () => {
      const ui = makeFakeUI();
      createTextStream(ui).endTimeline("Running 3 flows");
      expect(ui.outro).toHaveBeenCalledWith("Running 3 flows");
    });
  });

  describe("write", () => {
    it("prepends blank line before first write after endTimeline", () => {
      const { ui, writes } = makeCapturingUI();
      const stream = createTextStream(ui);
      stream.endTimeline("Running");
      stream.write("• flow-name path\n");
      expect(writes).toEqual(["\n", "• flow-name path\n"]);
    });

    it("does not prepend blank line on subsequent writes", () => {
      const { ui, writes } = makeCapturingUI();
      const stream = createTextStream(ui);
      stream.endTimeline("Running");
      stream.write("line one\n");
      stream.write("line two\n");
      expect(writes).toEqual(["\n", "line one\n", "line two\n"]);
    });

    it("ignores empty string and does not set hasContent", () => {
      const { ui, writes } = makeCapturingUI();
      const stream = createTextStream(ui);
      stream.endTimeline("Running");
      stream.write("");
      stream.write("content\n");
      expect(writes).toEqual(["\n", "content\n"]);
    });
  });

  describe("beginTimeline", () => {
    it("calls ui.intro with no preamble when content ends with newline", () => {
      const { ui, writes } = makeCapturingUI();
      const stream = createTextStream(ui);
      stream.endTimeline("Running");
      stream.write("output\n");
      stream.beginTimeline("Summary");
      expect(writes).toEqual(["\n", "output\n"]);
      expect(ui.intro).toHaveBeenCalledWith("Summary");
    });

    it("emits newline before intro when content does not end with newline", () => {
      const { ui, writes } = makeCapturingUI();
      const stream = createTextStream(ui);
      stream.endTimeline("Running");
      stream.write("partial output");
      stream.beginTimeline("Summary");
      expect(writes).toEqual(["\n", "partial output", "\n"]);
      expect(ui.intro).toHaveBeenCalledWith("Summary");
    });

    it("calls ui.intro directly when no content was written", () => {
      const { ui, writes } = makeCapturingUI();
      const stream = createTextStream(ui);
      stream.endTimeline("Running");
      stream.beginTimeline("Summary");
      expect(writes).toEqual([]);
      expect(ui.intro).toHaveBeenCalledWith("Summary");
    });

    it("calls ui.intro with no preamble when endTimeline was never called", () => {
      const { ui, writes } = makeCapturingUI();
      const stream = createTextStream(ui);
      stream.beginTimeline("Title");
      expect(writes).toEqual([]);
      expect(ui.intro).toHaveBeenCalledWith("Title");
    });
  });
});
