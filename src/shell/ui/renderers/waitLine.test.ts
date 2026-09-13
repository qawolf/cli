import { describe, expect, it } from "bun:test";

import { startWaitLine } from "./waitLine.js";

const erase = "\r\x1b[2K";

describe("startWaitLine", () => {
  it("draws the message with a count-up, then erases itself on stop", async () => {
    const writes: string[] = [];
    const handle = startWaitLine("Waiting", { write: (t) => writes.push(t) });

    await new Promise((resolve) => setTimeout(resolve, 300));
    handle.stop();

    expect(writes.length).toBeGreaterThan(2);
    expect(writes[0]).toContain("Waiting [0s]");
    expect(writes.every((w) => w.startsWith(erase))).toBe(true);
    expect(writes[writes.length - 1]).toBe(erase);
  });

  it("stops once, however many times it is asked to", () => {
    const writes: string[] = [];
    const handle = startWaitLine("Waiting", { write: (t) => writes.push(t) });

    handle.stop();
    handle.stop();

    expect(writes.filter((w) => w === erase)).toHaveLength(1);
  });
});
