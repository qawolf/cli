import type JSZip from "jszip";

import type { ArtifactFailure } from "~/domains/investigation/types.js";

import type { RangedZip } from "~/domains/investigation/parser/zip/rangedZip.js";
import { isReadFailure } from "~/domains/investigation/parser/zip/zipRangeReader.js";
import {
  type EntryRead,
  unreadableEntry,
} from "~/domains/investigation/parser/zip/zipEntryRead.js";

import { readZipBytes } from "./playwrightTraceUtils.js";

/** The files of a trace zip, read one at a time; an entry over `limit` reads as an incomplete prefix, and a failed storage read as that failure. */
export type TraceArchive = {
  has: (name: string) => boolean;
  /** Every file's name, in archive order, without directories. */
  names: () => string[];
  read: (name: string, limit: number) => Promise<EntryRead | ArtifactFailure>;
};

export function jsZipTraceArchive(zip: JSZip): TraceArchive {
  return {
    has: (name) => zip.file(name) !== null,
    names: () =>
      Object.values(zip.files)
        .filter((entry) => !entry.dir)
        .map((entry) => entry.name),
    async read(name, limit) {
      const entry = zip.file(name);
      return entry ? readZipBytes(entry, limit) : unreadableEntry;
    },
  };
}

export function rangedTraceArchive(zip: RangedZip): TraceArchive {
  const entries = new Map(
    zip.entries
      .filter((entry) => !entry.name.endsWith("/"))
      .map((entry) => [entry.name, entry]),
  );
  return {
    has: (name) => entries.has(name),
    names: () => [...entries.keys()],
    async read(name, limit) {
      const entry = entries.get(name);
      return entry ? zip.read(entry, limit) : unreadableEntry;
    },
  };
}

export async function readZipText(
  archive: TraceArchive,
  name: string | undefined,
  limit: number,
): Promise<
  | { incomplete: boolean; malformed: boolean; text: string }
  | ArtifactFailure
  | undefined
> {
  if (name === undefined) return undefined;
  const content = await archive.read(name, limit);
  if (isReadFailure(content)) return content;
  return { ...content, text: content.bytes.toString("utf8") };
}
