import type { UI } from "./types.js";

export type TextStream = {
  endTimeline(message: string): void;
  write(text: string): void;
  beginTimeline(title: string): void;
};

export function createTextStream(ui: UI): TextStream {
  let atLineStart = true;
  let hasContent = false;

  return {
    endTimeline(message) {
      ui.outro(message);
      atLineStart = true;
    },
    write(text) {
      if (!text) return;
      if (!hasContent) {
        ui.write("\n");
        hasContent = true;
        atLineStart = true;
      }
      ui.write(text);
      atLineStart = text[text.length - 1] === "\n";
    },
    beginTimeline(title) {
      if (hasContent && !atLineStart) ui.write("\n");
      ui.intro(title);
    },
  };
}
