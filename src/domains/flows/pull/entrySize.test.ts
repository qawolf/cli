import { describe, expect, it, mock } from "bun:test";
import type { ReadEntry } from "tar";

import { checkEntrySize } from "./entrySize.js";

function makeEntry(size: number | undefined): {
  entry: ReadEntry;
  resume: ReturnType<typeof mock>;
} {
  const resume = mock(() => {});
  const entry = { path: "a.flow.ts", size, resume } as unknown as ReadEntry;
  return { entry, resume };
}

describe("checkEntrySize", () => {
  it("returns the size when within both caps", () => {
    const { entry, resume } = makeEntry(40);

    const size = checkEntrySize({
      entry,
      maxEntryBytes: 50,
      maxTotalBytes: 100,
      total: 0,
    });

    expect(size).toBe(40);
    expect(resume).not.toHaveBeenCalled();
  });

  it("rejects an entry with an undefined size instead of treating it as zero", () => {
    const { entry, resume } = makeEntry(undefined);

    expect(() =>
      checkEntrySize({
        entry,
        maxEntryBytes: 50,
        maxTotalBytes: 100,
        total: 0,
      }),
    ).toThrow(/unknown size.*a\.flow\.ts/);
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("accepts an entry exactly at the per-entry cap", () => {
    const { entry, resume } = makeEntry(50);

    const size = checkEntrySize({
      entry,
      maxEntryBytes: 50,
      maxTotalBytes: 100,
      total: 0,
    });

    expect(size).toBe(50);
    expect(resume).not.toHaveBeenCalled();
  });

  it("accepts an entry that lands exactly on the total cap", () => {
    const { entry, resume } = makeEntry(30);

    const size = checkEntrySize({
      entry,
      maxEntryBytes: 50,
      maxTotalBytes: 100,
      total: 70,
    });

    expect(size).toBe(30);
    expect(resume).not.toHaveBeenCalled();
  });

  it("rejects an entry exceeding the per-entry cap", () => {
    const { entry, resume } = makeEntry(60);

    expect(() =>
      checkEntrySize({
        entry,
        maxEntryBytes: 50,
        maxTotalBytes: 100,
        total: 0,
      }),
    ).toThrow(/exceeds max size/);
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("rejects an entry that would push the running total over the cap", () => {
    const { entry, resume } = makeEntry(40);

    expect(() =>
      checkEntrySize({
        entry,
        maxEntryBytes: 50,
        maxTotalBytes: 100,
        total: 70,
      }),
    ).toThrow(/total uncompressed size/);
    expect(resume).toHaveBeenCalledTimes(1);
  });
});
