import { afterEach, describe, expect, it } from "bun:test";

import { readStdin } from "./stdin.js";

const wasTTY = process.stdin.isTTY;

afterEach(() => {
  Object.defineProperty(process.stdin, "isTTY", {
    configurable: true,
    value: wasTTY,
  });
});

describe("readStdin", () => {
  // Otherwise `qawolf runner act -` with the pipe forgotten waits for a Ctrl-D
  // that an agent has no way to send.
  it("reads a terminal as nothing piped in rather than waiting", async () => {
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: true,
    });

    expect(await readStdin()).toBe("");
  });
});
