// oxlint-disable eslint/max-lines -- Keep aggregate archive budgets and page-to-stream attribution aligned with the optimized platform reader.

import { indexTraceStreamPages } from "./playwrightTraceNetworkStreams.js";
import type {
  Bounded,
  PlaywrightTrace,
  TraceNetworkEntry,
} from "./playwrightTraceTypes.js";
import { traceLimits } from "./playwrightTraceTypes.js";
import {
  asObject,
  bounded,
  parseJson,
  readZipBytes,
  readZipText,
} from "./playwrightTraceUtils.js";

const sensitive =
  /^(authorization|cookie|set-cookie|proxy-authorization|x-api-key)$/i;
const networkCache = new WeakMap<
  PlaywrightTrace,
  ReturnType<typeof readNetwork>
>();
const headers = (value: unknown): Record<string, string> =>
  Array.isArray(value)
    ? Object.fromEntries(
        value.flatMap((header) => {
          const object = asObject(header);
          return object &&
            typeof object.name === "string" &&
            typeof object.value === "string"
            ? [
                [
                  object.name,
                  sensitive.test(object.name) ? "[REDACTED]" : object.value,
                ],
              ]
            : [];
        }),
      )
    : {};

async function parseNetwork(trace: PlaywrightTrace, maxEntryBytes: number) {
  const entries = Object.values(trace.archive.files)
    .filter((entry) => !entry.dir && entry.name.endsWith(".network"))
    .sort((left, right) => left.name.localeCompare(right.name));
  const items: { object: Record<string, unknown>; streamId: string }[] = [];
  let decodedBytes = trace.artifactBudget.decodedBytes;
  let eventCount = trace.artifactBudget.events;
  let memberCount = trace.artifactBudget.members;
  let malformed = 0;
  let incomplete = false;
  for (const entry of entries) {
    if (
      decodedBytes >= trace.limits.maxTotalDecodedBytes ||
      eventCount >= trace.limits.maxEvents ||
      memberCount >= trace.limits.maxMembers
    ) {
      incomplete = true;
      break;
    }
    const content = await readZipText(
      entry,
      Math.min(
        maxEntryBytes,
        trace.limits.maxEntryBytes,
        trace.limits.maxTotalDecodedBytes - decodedBytes,
      ),
    );
    if (!content) continue;
    decodedBytes += Buffer.byteLength(content.text);
    memberCount += 1;
    incomplete ||= content.incomplete;
    if (content.malformed) {
      malformed += 1;
      continue;
    }
    const tracePrefix = `${entry.name.replace(/\.network$/, ".trace")}#`;
    const pairedStreams = trace.streams.filter((stream) =>
      stream.id.startsWith(tracePrefix),
    );
    if (!pairedStreams.length) {
      malformed += 1;
      continue;
    }
    const fallbackStream = pairedStreams[0];
    if (!fallbackStream) continue;
    const streamIdsByPage = indexTraceStreamPages(pairedStreams);
    const lines = content.text.split("\n").filter(Boolean);
    for (const line of lines) {
      if (eventCount >= trace.limits.maxEvents) {
        incomplete = true;
        break;
      }
      eventCount += 1;
      const object = asObject(parseJson(line));
      if (!object) {
        malformed += 1;
        continue;
      }
      const snapshot = asObject(object.snapshot);
      const pageId =
        typeof snapshot?.pageref === "string" ? snapshot.pageref : undefined;
      items.push({
        object,
        streamId: streamIdsByPage.get(pageId) ?? fallbackStream.id,
      });
    }
  }
  return { incomplete, items, malformed };
}

async function readNetwork(trace: PlaywrightTrace, maxEntryBytes: number) {
  const parsed = await parseNetwork(trace, maxEntryBytes);
  const items = parsed.items.flatMap(({ object, streamId }, index) => {
    if (object["type"] !== "resource-snapshot") return [];
    const snapshot = asObject(object["snapshot"]);
    const request = asObject(snapshot?.request);
    const response = asObject(snapshot?.response);
    const content = asObject(response?.content);
    if (
      !request ||
      typeof request.url !== "string" ||
      typeof request.method !== "string"
    )
      return [];
    const bodyResourceName =
      typeof content?._sha1 === "string"
        ? `resources/${content._sha1}`
        : undefined;
    return [
      {
        bodyAvailable:
          bodyResourceName !== undefined &&
          trace.archive.file(bodyResourceName) !== null,
        bodyResourceName,
        durationMilliseconds:
          typeof snapshot?.time === "number" ? snapshot.time : undefined,
        failureText:
          typeof response?._failureText === "string"
            ? response._failureText
            : undefined,
        frameId:
          typeof snapshot?._frameref === "string"
            ? snapshot._frameref
            : undefined,
        id: `${streamId}:network:${index}`,
        method: request.method,
        pageId:
          typeof snapshot?.pageref === "string" ? snapshot.pageref : undefined,
        requestHeaders: headers(request.headers),
        responseHeaders: headers(response?.headers),
        startedAtMilliseconds:
          typeof snapshot?._monotonicTime === "number"
            ? snapshot._monotonicTime
            : undefined,
        status:
          typeof response?.status === "number" ? response.status : undefined,
        streamId,
        url: request.url,
      },
    ];
  });
  return { ...parsed, items };
}

export async function listTraceNetwork(
  trace: PlaywrightTrace,
  options: { limit?: number; maxEntryBytes?: number } = {},
): Promise<Bounded<TraceNetworkEntry>> {
  const maxEntryBytes = options.maxEntryBytes ?? traceLimits.maxEntryBytes;
  const useCache = maxEntryBytes === traceLimits.maxEntryBytes;
  const cached = useCache ? networkCache.get(trace) : undefined;
  const pending = cached ?? readNetwork(trace, maxEntryBytes);
  if (useCache && !cached) networkCache.set(trace, pending);
  const parsed = await pending;
  return bounded(parsed.items, options.limit ?? traceLimits.maxItems, {
    incomplete: trace.incomplete || parsed.incomplete,
    malformed: trace.malformedLineCount + parsed.malformed,
  });
}

export async function readTraceResponseBody(
  trace: PlaywrightTrace,
  networkId: string,
  options: { maxBytes?: number } = {},
): Promise<
  | { bodyBase64: string; status: "available"; truncated: boolean }
  | { status: "unavailable" }
> {
  const entry = (
    await listTraceNetwork(trace, { limit: Number.MAX_SAFE_INTEGER })
  ).items.find((item) => item.id === networkId);
  if (!entry?.bodyResourceName) return { status: "unavailable" };
  const resource = trace.archive.file(entry.bodyResourceName);
  if (!resource) return { status: "unavailable" };
  const limit = options.maxBytes ?? traceLimits.maxBodyBytes;
  const content = await readZipBytes(resource, limit);
  if (content.malformed) return { status: "unavailable" };
  return {
    bodyBase64: content.bytes.toString("base64"),
    status: "available",
    truncated: content.incomplete,
  };
}
