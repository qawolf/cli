import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { sleep } from "~/core/sleep.js";
import { createFilterList } from "./filterList.js";
const frameStart = "\x1b[?2026h";
export function fakeTerminal() {
  const writes: string[] = [];
  return Object.assign(new EventEmitter(), {
    columns: 80,
    rows: 24,
    isTTY: true,
    writes,
    write(
      chunk: Uint8Array | string,
      callback: (error?: Error | null) => void,
    ) {
      writes.push(String(chunk));
      // Later, as a real terminal calls back; at once would hide writes
      // left waiting in a queue.
      setImmediate(() => callback());
      return true;
    },
  });
}

/** Opens the real prompt against fake streams; type into `input` to drive it. */
export function open(terminal: ReturnType<typeof fakeTerminal>) {
  const input = new PassThrough();
  const previousTerm = process.env["TERM"];
  process.env["TERM"] = "xterm-256color";
  const result = createFilterList({ mode: "human", input, output: terminal })({
    message: "Filter things",
    items: ["alpha", "beta", "gamma"],
    searchText: (item) => [item],
    table: () => ({ header: "name", line: (item) => item }),
    describeCount: (matched, total) => `${String(matched)} of ${String(total)}`,
    detail: (item) => `about ${item}`,
  });
  if (previousTerm === undefined) delete process.env["TERM"];
  else process.env["TERM"] = previousTerm;
  return { input, result };
}

export const typed = (input: PassThrough, text: string) => {
  input.write(text);
  // Let readline turn the bytes into keypresses before looking.
  return sleep(20);
};

export const paints = (terminal: ReturnType<typeof fakeTerminal>): string[] =>
  terminal.writes.filter((write) => write.startsWith(frameStart));
