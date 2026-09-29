import JSZip from "jszip";

import { parseTraceEntry } from "./playwrightTraceParseEntry.js";
import type {
  PlaywrightTrace,
  TraceLimits,
  TraceReadResult,
} from "./playwrightTraceTypes.js";
import { traceLimits } from "./playwrightTraceTypes.js";

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
    return {
      incomplete: true,
      malformedLineCount: 1,
      reason: "invalid-zip",
      status: "malformed",
    };
  }
  const entries = Object.values(archive.files)
    .filter((entry) => !entry.dir && entry.name.endsWith(".trace"))
    .sort((left, right) => left.name.localeCompare(right.name));
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
