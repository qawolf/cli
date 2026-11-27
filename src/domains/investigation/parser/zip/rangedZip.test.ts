import { describe, expect, it } from "bun:test";
import { randomBytes } from "node:crypto";

import type { RangeReader } from "~/domains/investigation/types.js";

import {
  type RangedZipLimits,
  openRangedZip,
  rangedZipLimits,
} from "./rangedZip.js";
import {
  buildZip,
  centralField,
  memoryRangeReader,
  withCentralField,
} from "./zipFixture.testUtils.js";

const longText = "hello ".repeat(1000);

async function open(
  zip: Buffer,
  limits: Partial<RangedZipLimits> = {},
  readRange: RangeReader = memoryRangeReader(zip).readRange,
) {
  return openRangedZip({
    limits: { ...rangedZipLimits, ...limits },
    readRange,
    sizeBytes: zip.length,
  });
}

async function openOrThrow(zip: Buffer, limits: Partial<RangedZipLimits> = {}) {
  const opened = await open(zip, limits);
  if (opened === "malformed" || "status" in opened)
    throw new Error(`Unreadable zip: ${JSON.stringify(opened)}`);
  return opened;
}

async function readEntry(
  zip: Buffer,
  name: string,
  {
    limit = 1024 * 1024,
    ...limits
  }: Partial<RangedZipLimits> & { limit?: number } = {},
) {
  const opened = await openOrThrow(zip, limits);
  const entry = opened.entries.find((candidate) => candidate.name === name);
  if (!entry) throw new Error(`No entry ${name}`);
  return opened.read(entry, limit);
}

describe("openRangedZip", () => {
  it.each([false, true])(
    "lists and reads stored and deflated entries (zip64: %s)",
    async (zip64) => {
      const zip = buildZip(
        [
          { compress: true, content: longText, name: "0-trace.trace" },
          { content: "jpeg-bytes", name: "resources/a.jpeg" },
          { content: "", name: "resources/" },
        ],
        { zip64 },
      );
      const opened = await openOrThrow(zip);

      expect(opened.entries.map(({ name }) => name)).toEqual([
        "0-trace.trace",
        "resources/a.jpeg",
        "resources/",
      ]);
      const trace = await readEntry(zip, "0-trace.trace");
      const jpeg = await readEntry(zip, "resources/a.jpeg");
      expect(trace).toEqual({
        bytes: Buffer.from(longText),
        incomplete: false,
        malformed: false,
      });
      expect(jpeg).toMatchObject({ bytes: Buffer.from("jpeg-bytes") });
    },
  );

  it.each([false, true])(
    "reads a prefix of an entry over the limit (deflated: %s)",
    async (compress) => {
      const zip = buildZip([{ compress, content: longText, name: "a.txt" }]);

      const read = await readEntry(zip, "a.txt", { limit: 10 });

      expect(read).toEqual({
        bytes: Buffer.from(longText.slice(0, 10)),
        incomplete: true,
        malformed: false,
      });
    },
  );

  it("answers malformed for a file that is no zip", async () => {
    expect(await open(Buffer.from("not a zip at all, not even close"))).toBe(
      "malformed",
    );
  });

  it("passes a failed storage read through", async () => {
    const zip = buildZip([{ content: longText, name: "a.txt" }]);
    const expired: RangeReader = async () => ({ status: "expired-url" });

    expect(await open(zip, {}, expired)).toEqual({ status: "expired-url" });
  });

  it("finds the end record past a comment that holds the record's signature", async () => {
    const zip = buildZip([{ content: longText, name: "a.txt" }], {
      comment: `PK\u0005\u0006${"x".repeat(30)}`,
    });

    expect((await openOrThrow(zip)).entries.map(({ name }) => name)).toEqual([
      "a.txt",
    ]);
  });

  it("answers too-large for a directory over its byte or entry limit", async () => {
    const zip = buildZip([
      { content: "a", name: "a.txt" },
      { content: "b", name: "b.txt" },
    ]);

    expect(await open(zip, { maxDirectoryBytes: zip.length + 10 })).toEqual({
      status: "too-large",
    });
    expect(await open(zip, { maxEntries: 1 })).toEqual({ status: "too-large" });
  });

  it("fails a read past the fetch budget as too-large without fetching it", async () => {
    const zip = buildZip([
      { content: randomBytes(64 * 1024), name: "resources/big.jpeg" },
    ]);
    const source = memoryRangeReader(zip);
    const opened = await open(
      zip,
      { maxFetchedBytes: 32 * 1024 },
      source.readRange,
    );
    if (opened === "malformed" || "status" in opened)
      throw new Error("Expected the directory to fit the budget");
    const [entry] = opened.entries;
    if (!entry) throw new Error("Expected an entry");
    const fetchedToOpen = source.bytesRead();

    const read = await opened.read(entry, 1024 * 1024);

    expect(read).toEqual({ status: "too-large" });
    expect(source.bytesRead() - fetchedToOpen).toBeLessThan(1024);
  });

  it("answers malformed for an entry whose CRC-32 does not match", async () => {
    const zip = withCentralField(
      buildZip([{ compress: true, content: longText, name: "a.txt" }]),
      { field: centralField.crc32, name: "a.txt", value: 1234 },
    );

    expect(await readEntry(zip, "a.txt")).toMatchObject({ malformed: true });
  });

  it("answers malformed for a stored entry whose sizes disagree, without reading its data", async () => {
    const zip = withCentralField(
      buildZip([{ content: longText, name: "a.txt" }]),
      {
        field: centralField.compressedSize,
        name: "a.txt",
        value: longText.length - 1,
      },
    );

    expect(await readEntry(zip, "a.txt")).toMatchObject({ malformed: true });
  });

  it("stops inflating a decompression bomb at its declared size", async () => {
    const zip = withCentralField(
      buildZip([
        {
          compress: true,
          content: Buffer.alloc(64 * 1024 * 1024),
          name: "bomb.trace",
        },
      ]),
      {
        field: centralField.uncompressedSize,
        name: "bomb.trace",
        value: 100_000,
      },
    );

    expect(
      await readEntry(zip, "bomb.trace", { limit: 16 * 1024 * 1024 }),
    ).toMatchObject({
      malformed: true,
    });
  });

  it("answers malformed, without fetching, for a compressed size no deflate stream needs", async () => {
    const zip = withCentralField(
      buildZip([{ compress: true, content: randomBytes(8192), name: "a.txt" }]),
      { field: centralField.uncompressedSize, name: "a.txt", value: 10 },
    );
    const source = memoryRangeReader(zip);
    const opened = await open(zip, {}, source.readRange);
    if (opened === "malformed" || "status" in opened)
      throw new Error("Expected a readable directory");
    const [entry] = opened.entries;
    if (!entry) throw new Error("Expected an entry");
    const fetchedToOpen = source.bytesRead();

    expect(await opened.read(entry, 1024)).toMatchObject({ malformed: true });
    expect(source.bytesRead()).toBe(fetchedToOpen);
  });

  it("answers malformed when an entry's data would run into the directory", async () => {
    const zip = withCentralField(
      buildZip([{ compress: true, content: "tiny", name: "a.txt" }]),
      { field: centralField.compressedSize, name: "a.txt", value: 10_000_000 },
    );

    expect(await open(zip)).toBe("malformed");
  });
});
