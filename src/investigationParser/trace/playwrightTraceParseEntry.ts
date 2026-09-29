// oxlint-disable eslint/max-lines -- Keep the per-entry archive budget and stream segmentation in one module.

import type JSZip from "jszip";

import { normalizeTraceEvent } from "./playwrightTraceEvent.js";
import type {
  TraceLimits,
  TraceStackFrame,
  TraceStacks,
  TraceStream,
} from "./playwrightTraceTypes.js";
import { asObject, parseJson, readZipText } from "./playwrightTraceUtils.js";

function parseStacks(raw: string | undefined): TraceStacks {
  const value = raw === undefined ? undefined : asObject(parseJson(raw));
  if (!value || !Array.isArray(value.files) || !Array.isArray(value.stacks))
    return { files: [], stacks: [] };
  const files = value.files.filter(
    (file): file is string => typeof file === "string",
  );
  const stacks = value.stacks.flatMap((entry) => {
    if (
      !Array.isArray(entry) ||
      typeof entry[0] !== "number" ||
      !Array.isArray(entry[1])
    )
      return [];
    const frames = entry[1].filter(
      (frame): frame is TraceStackFrame =>
        Array.isArray(frame) &&
        typeof frame[0] === "number" &&
        typeof frame[1] === "number" &&
        typeof frame[2] === "number",
    );
    return [[entry[0], frames] as [number, TraceStackFrame[]]];
  });
  return { files, stacks };
}

export async function parseTraceEntry({
  archive,
  budget,
  limits,
  traceEntry,
}: {
  archive: JSZip;
  budget: { decodedBytes: number; events: number; members: number };
  limits: TraceLimits;
  traceEntry: JSZip.JSZipObject;
}): Promise<{
  decodedBytes: number;
  events: number;
  incomplete: boolean;
  malformedLineCount: number;
  members: number;
  streams: TraceStream[];
}> {
  const traceLimit = Math.min(
    limits.maxEntryBytes,
    Math.max(0, limits.maxTotalDecodedBytes - budget.decodedBytes),
  );
  if (traceLimit === 0) {
    return {
      decodedBytes: 0,
      events: 0,
      incomplete: true,
      malformedLineCount: 0,
      members: 1,
      streams: [],
    };
  }
  const traceText = await readZipText(traceEntry, traceLimit);
  if (!traceText || traceText.malformed) {
    return {
      decodedBytes: traceText ? Buffer.byteLength(traceText.text) : 0,
      events: 0,
      incomplete: true,
      malformedLineCount: 1,
      members: 1,
      streams: [],
    };
  }
  let decodedBytes = Buffer.byteLength(traceText.text);
  const stem = traceEntry.name.replace(/\.trace$/, "");
  const stacksEntry = archive.file(`${stem}.stacks`) ?? undefined;
  const stacksBudgetExceeded =
    stacksEntry !== undefined && budget.members + 1 >= limits.maxMembers;
  const stacksLimit = Math.min(
    limits.maxEntryBytes,
    Math.max(
      0,
      limits.maxTotalDecodedBytes - budget.decodedBytes - decodedBytes,
    ),
  );
  const stacksText = await readZipText(
    stacksBudgetExceeded ? undefined : stacksEntry,
    stacksLimit,
  );
  decodedBytes += stacksText ? Buffer.byteLength(stacksText.text) : 0;
  const stacks = parseStacks(
    stacksText?.malformed ? undefined : stacksText?.text,
  );
  const streams: TraceStream[] = [];
  let current: TraceStream | undefined;
  let processedEventCount = 0;
  let malformedLineCount = stacksText?.malformed ? 1 : 0;
  let pendingMalformed = 0;
  let segment = -1;
  const lines = traceText.text.split("\n");
  const lineCount = lines.filter(Boolean).length;
  let processedLineCount = 0;
  let trailingMalformed = false;
  for (const [lineIndex, line] of lines.entries()) {
    if (!line) continue;
    if (budget.events + processedEventCount >= limits.maxEvents) break;
    processedLineCount += 1;
    processedEventCount += 1;
    const event = normalizeTraceEvent(parseJson(line));
    if (!event) {
      trailingMalformed ||= lineIndex === lines.length - 1;
      malformedLineCount += 1;
      if (current) current.malformedLineCount += 1;
      else pendingMalformed += 1;
      continue;
    }
    if (!current || event.type === "context-options") {
      current = {
        events: [],
        id: `${traceEntry.name}#${(segment += 1)}`,
        incomplete: false,
        malformedLineCount: pendingMalformed,
        stacks,
      };
      pendingMalformed = 0;
      streams.push(current);
    }
    current.events.push(event);
  }
  const eventLimitReached =
    budget.events + processedEventCount >= limits.maxEvents &&
    processedLineCount < lineCount;
  const incomplete =
    traceText.incomplete ||
    stacksText?.incomplete === true ||
    stacksBudgetExceeded ||
    trailingMalformed ||
    eventLimitReached;
  if (current) current.incomplete = incomplete;
  return {
    decodedBytes,
    events: processedEventCount,
    incomplete,
    malformedLineCount,
    members: stacksEntry && !stacksBudgetExceeded ? 2 : 1,
    streams,
  };
}
