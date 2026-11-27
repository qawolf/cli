import JSZip from "jszip";

import {
  type RangedZipLimits,
  openRangedZip,
  rangedZipLimits,
} from "~/domains/investigation/parser/zip/rangedZip.js";
import { isReadFailure } from "~/domains/investigation/parser/zip/zipRangeReader.js";
import type { RangeReader } from "~/domains/investigation/types.js";

import {
  type TraceArchive,
  jsZipTraceArchive,
  rangedTraceArchive,
} from "./playwrightTraceArchive.js";
import { parseTraceEntry } from "./playwrightTraceParseEntry.js";
import type {
  PlaywrightTrace,
  TraceLimits,
  TraceReadResult,
} from "./playwrightTraceTypes.js";
import { traceLimits } from "./playwrightTraceTypes.js";

const invalidZip: TraceReadResult = {
  incomplete: true,
  malformedLineCount: 1,
  reason: "invalid-zip",
  status: "malformed",
};

export async function parsePlaywrightTraceArchive(
  raw: Buffer,
  options: { limits?: Partial<TraceLimits> } = {},
): Promise<TraceReadResult> {
  const limits = { ...traceLimits, ...options.limits };
  if (raw.byteLength > limits.maxArchiveBytes) {
    return {
      incomplete: true,
      malformedLineCount: 0,
      reason: "archive-too-large",
      status: "malformed",
    };
  }
  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(raw);
  } catch {
    return invalidZip;
  }
  return parseTraceArchive(jsZipTraceArchive(archive), limits);
}

/** Parses a trace zip read by range, fetching only the directory and the entries a projection reads. */
export async function parseRangedPlaywrightTrace(
  source: { readRange: RangeReader; sizeBytes: number },
  options: {
    limits?: Partial<TraceLimits>;
    zipLimits?: Partial<RangedZipLimits>;
  } = {},
): Promise<TraceReadResult> {
  const zip = await openRangedZip({
    limits: { ...rangedZipLimits, ...options.zipLimits },
    readRange: source.readRange,
    sizeBytes: source.sizeBytes,
  });
  if (zip === "malformed") return invalidZip;
  if (isReadFailure(zip)) return zip;
  return parseTraceArchive(rangedTraceArchive(zip), {
    ...traceLimits,
    ...options.limits,
  });
}

async function parseTraceArchive(
  archive: TraceArchive,
  limits: TraceLimits,
): Promise<TraceReadResult> {
  const entries = archive
    .names()
    .filter((name) => name.endsWith(".trace"))
    .sort((left, right) => left.localeCompare(right));
  if (!entries.length) {
    return {
      incomplete: false,
      malformedLineCount: 0,
      reason: "no-trace-stream",
      status: "malformed",
    };
  }
  const budget = { decodedBytes: 0, events: 0, members: 0 };
  const parsedEntries = [];
  for (const entry of entries) {
    if (budget.members >= limits.maxMembers) break;
    const parsed = await parseTraceEntry({
      archive,
      budget,
      limits,
      traceEntry: entry,
    });
    budget.decodedBytes += parsed.decodedBytes;
    budget.events += parsed.events;
    budget.members += parsed.members;
    parsedEntries.push(parsed);
  }
  const streams = parsedEntries.flatMap((entry) => entry.streams);
  const incomplete =
    entries.length > parsedEntries.length ||
    parsedEntries.some((entry) => entry.incomplete);
  const malformedLineCount = parsedEntries.reduce(
    (sum, entry) => sum + entry.malformedLineCount,
    0,
  );
  if (!streams.length) {
    return {
      incomplete,
      malformedLineCount,
      reason: "no-trace-stream",
      status: "malformed",
    };
  }
  const trace: PlaywrightTrace = {
    archive,
    artifactBudget: budget,
    incomplete,
    limits,
    malformedLineCount,
    streams,
  };
  return { status: trace.incomplete ? "incomplete" : "ready", trace };
}
