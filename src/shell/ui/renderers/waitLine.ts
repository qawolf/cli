import { styleText } from "node:util";

// clack's own spinner frames, so a wait reads like the rest of the rail.
const frames = ["◒", "◐", "◓", "◑"];
const frameMs = 120;

function elapsed(sinceMs: number): string {
  const seconds = Math.floor((Date.now() - sinceMs) / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `[${minutes}m ${seconds % 60}s]` : `[${seconds}s]`;
}

/**
 * One line that spins and counts up until stopped, and then is erased.
 *
 * Drawn here rather than by clack's spinner because that one puts stdin in raw
 * mode and, on a Ctrl-C keypress, exits 0 by itself before the CLI's signal
 * handling can run. This line touches only stdout, so Ctrl-C still arrives as
 * a signal and the command gets to say what it promised.
 */
export function startWaitLine(
  message: string,
  output: { write(text: string): unknown } = process.stdout,
): { stop(): void } {
  const startedAt = Date.now();
  let frame = 0;
  const draw = () => {
    const mark = styleText("magenta", frames[frame] ?? "◒");
    output.write(`\r\x1b[2K${mark}  ${message} ${elapsed(startedAt)}`);
    frame = (frame + 1) % frames.length;
  };
  draw();
  const timer = setInterval(draw, frameMs);
  let stopped = false;
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      output.write("\r\x1b[2K");
    },
  };
}
