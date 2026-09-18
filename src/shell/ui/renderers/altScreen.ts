// The alternate screen prevents resized frames from entering scrollback and
// restores the user's original screen when the view closes.
const enterAltScreen = "\x1b[?1049h";
const leaveAltScreen = "\x1b[?1049l";
const hideCursor = "\x1b[?25l";
const showCursor = "\x1b[?25h";
// Synchronized output: supporting terminals show each frame whole rather than
// half-written; the rest ignore the sequence.
const beginFrame = "\x1b[?2026h\x1b[H";
const endFrame = "\x1b[?2026l";
const clearToLineEnd = "\x1b[K";
const clearToScreenEnd = "\x1b[J";

type Writer = { write(chunk: string): unknown };

export function openAltScreen(output: Writer): {
  paint: (frame: string) => void;
  close: () => void;
} {
  let open = true;
  const close = (): void => {
    if (!open) return;
    open = false;
    process.off("exit", close);
    output.write(`${showCursor}${leaveAltScreen}`);
  };
  // Handed back however the view ends — even if the process exits first.
  process.once("exit", close);
  output.write(`${enterAltScreen}${hideCursor}`);

  return {
    paint(frame) {
      if (!open) return;
      // Clear before writing: after an exact-width line, the cursor still
      // occupies its last cell and a trailing erase would remove that cell.
      const lines = frame
        .split("\n")
        .map(
          (line, index, all) =>
            `${index === all.length - 1 ? clearToScreenEnd : clearToLineEnd}${line}`,
        );
      output.write(`${beginFrame}${lines.join("\r\n")}${endFrame}`);
    },
    close,
  };
}
