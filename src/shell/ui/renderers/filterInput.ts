import { emitKeypressEvents, type Key } from "node:readline";
import { PassThrough, type Readable } from "node:stream";

export function filterInput(
  source: Readable,
  consume: (key: Key) => boolean,
): { input: PassThrough; dispose: () => void } {
  const input = new PassThrough();
  const flowing = source.readableFlowing;
  Object.defineProperty(input, "isTTY", {
    get: () => "isTTY" in source && source.isTTY,
  });
  Object.defineProperty(input, "setRawMode", {
    value: (raw: boolean) => {
      if ("setRawMode" in source && typeof source.setRawMode === "function")
        source.setRawMode(raw);
    },
  });
  const onKey = (text: string | undefined, key: Key): void => {
    // Readline listens on the proxy, so action keys never reach its editor.
    if (!consume(key)) input.emit("keypress", text, key);
  };
  emitKeypressEvents(source);
  source.on("keypress", onKey);
  return {
    input,
    dispose() {
      source.off("keypress", onKey);
      if (!flowing) source.pause();
      input.destroy();
    },
  };
}
