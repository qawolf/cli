import { Writable } from "node:stream";

/** The parts of a terminal stream a prompt draws with; `process.stdout` is one. */
export type TerminalStream = {
  readonly columns?: number | undefined;
  readonly rows?: number | undefined;
  readonly isTTY?: boolean | undefined;
  write(
    chunk: Uint8Array | string,
    callback: (error?: Error | null) => void,
  ): boolean;
  on(event: "resize", listener: () => void): unknown;
  off(event: "resize", listener: () => void): unknown;
};

/**
 * A stand-in for `terminal` whose "resize" fires once, after the window stops
 * changing size, instead of once for every size it passes through.
 */
export function withDebouncedResize(
  terminal: TerminalStream,
  settleMs: number,
): { output: Writable; dispose: () => void } {
  const output = new Writable({
    decodeStrings: false,
    // Handed on and called back at once. A terminal calls back later, and
    // until then this stream would hold further writes in a queue of its own —
    // letting what is written straight to the terminal in the meantime, such
    // as what a command prints once the prompt ends, overtake them. The
    // terminal keeps its own queue, in order.
    write(chunk: Uint8Array | string, _encoding, callback) {
      terminal.write(chunk, () => {});
      callback();
    },
  });
  // Read live rather than copied: a prompt measures the stream it draws to on
  // every frame, and the frame must match the window as it is now.
  for (const key of ["columns", "rows", "isTTY"] as const) {
    Object.defineProperty(output, key, {
      enumerable: true,
      get: () => terminal[key],
    });
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const onResize = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      output.emit("resize");
    }, settleMs);
  };
  terminal.on("resize", onResize);

  return {
    output,
    dispose() {
      terminal.off("resize", onResize);
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}
