// oxlint-disable eslint/max-lines -- Keep media IDs, reads, and nearest-screenshot selection aligned with the platform reader.

import { isReadFailure } from "~/domains/investigation/parser/zip/zipRangeReader.js";
import type { ArtifactFailure } from "~/domains/investigation/types.js";

import { listTraceSnapshots } from "./playwrightTraceSnapshots.js";
import type {
  Bounded,
  PlaywrightTrace,
  TraceActionLog,
  TraceConsoleEntry,
  TraceScreenshot,
} from "./playwrightTraceTypes.js";
import { traceLimits } from "./playwrightTraceTypes.js";
import { bounded } from "./playwrightTraceUtils.js";

function listTraceScreenshots(
  trace: PlaywrightTrace,
  options: { limit?: number; pageId?: string } = {},
): Bounded<TraceScreenshot> {
  const items = trace.streams
    .flatMap((stream) =>
      stream.events.flatMap((event, index) =>
        event.type === "screencast-frame" && (event.file ?? event.sha1)
          ? [
              {
                height: event.height,
                id: `${stream.id}:screenshot:${index}`,
                pageId: event.pageId,
                resourceName: event.file ?? `resources/${event.sha1}`,
                streamId: stream.id,
                timestamp: event.timestamp,
                width: event.width,
              },
            ]
          : [],
      ),
    )
    .filter(
      (item) => options.pageId === undefined || item.pageId === options.pageId,
    );
  return bounded(items, options.limit ?? traceLimits.maxItems, {
    incomplete: trace.incomplete,
    malformed: trace.malformedLineCount,
  });
}

export async function readTraceScreenshot(
  trace: PlaywrightTrace,
  screenshotId: string,
  options: { maxBytes?: number } = {},
): Promise<
  | {
      imageJpegBase64: string;
      screenshot: TraceScreenshot;
      status: "available";
    }
  | {
      screenshot: TraceScreenshot;
      status: "missing" | ArtifactFailure["status"];
    }
  | undefined
> {
  const screenshot = listTraceScreenshots(trace, {
    limit: Number.MAX_SAFE_INTEGER,
  }).items.find((item) => item.id === screenshotId);
  if (!screenshot) return undefined;
  if (!trace.archive.has(screenshot.resourceName))
    return { screenshot, status: "missing" };
  const content = await trace.archive.read(
    screenshot.resourceName,
    options.maxBytes ?? traceLimits.maxBodyBytes,
  );
  if (isReadFailure(content)) return { screenshot, status: content.status };
  if (content.malformed) return { screenshot, status: "missing" };
  if (content.incomplete) return { screenshot, status: "too-large" };
  return {
    imageJpegBase64: content.bytes.toString("base64"),
    screenshot,
    status: "available",
  };
}

export function listTraceConsole(
  trace: PlaywrightTrace,
  options: { limit?: number; maxTextBytes?: number } = {},
): Bounded<TraceConsoleEntry> {
  const maxBytes = options.maxTextBytes ?? traceLimits.maxTextBytes;
  const items = trace.streams.flatMap((stream) =>
    stream.events.flatMap((event, index) => {
      if (event.type !== "console") return [];
      const text = typeof event.text === "string" ? event.text : "";
      const message =
        Buffer.byteLength(text) <= maxBytes
          ? text
          : `${Buffer.from(text).subarray(0, maxBytes).toString("utf8")}[TRUNCATED]`;
      return [
        {
          id: `${stream.id}:console:${index}`,
          message,
          pageId: event.pageId,
          streamId: stream.id,
          time: event.time,
          type: event.messageType ?? "log",
        },
      ];
    }),
  );
  return bounded(items, options.limit ?? traceLimits.maxItems, {
    incomplete: trace.incomplete,
    malformed: trace.malformedLineCount,
  });
}

export function listTraceActionLogs(
  trace: PlaywrightTrace,
  options: { limit?: number; maxTextBytes?: number } = {},
): Bounded<TraceActionLog> {
  const maxBytes = options.maxTextBytes ?? traceLimits.maxTextBytes;
  const items = trace.streams.flatMap((stream) =>
    stream.events.flatMap((event, index) => {
      if (event.type !== "log") return [];
      const actionId = event.callId
        ? `${stream.id}:action:${event.callId}`
        : undefined;
      const text = event.message ?? "";
      const message =
        Buffer.byteLength(text) <= maxBytes
          ? text
          : `${Buffer.from(text).subarray(0, maxBytes).toString("utf8")}[TRUNCATED]`;
      return [
        {
          actionId,
          id: `${stream.id}:action-log:${index}`,
          message,
          pageId: event.pageId,
          streamId: stream.id,
          time: event.time,
          type: "action",
        },
      ];
    }),
  );
  return bounded(items, options.limit ?? traceLimits.maxItems, {
    incomplete: trace.incomplete,
    malformed: trace.malformedLineCount,
  });
}

export function nearestScreenshotForSnapshot(
  trace: PlaywrightTrace,
  snapshotId: string,
) {
  const snapshot = listTraceSnapshots(trace, {
    limit: Number.MAX_SAFE_INTEGER,
  }).items.find((item) => item.id === snapshotId);
  if (!snapshot || snapshot.timestamp === undefined) return undefined;
  const timestamp = snapshot.timestamp;
  const nearest = listTraceScreenshots(trace, {
    limit: Number.MAX_SAFE_INTEGER,
    ...(snapshot.pageId !== undefined && { pageId: snapshot.pageId }),
  })
    .items.filter(
      (item) =>
        item.streamId === snapshot.streamId && item.timestamp !== undefined,
    )
    .map((screenshot) => ({
      delta: (screenshot.timestamp ?? 0) - timestamp,
      screenshot,
    }))
    .sort((left, right) => Math.abs(left.delta) - Math.abs(right.delta))[0];
  return nearest
    ? {
        deltaMilliseconds: Math.abs(nearest.delta),
        relationship:
          nearest.delta === 0
            ? ("same-time" as const)
            : nearest.delta < 0
              ? ("before" as const)
              : ("after" as const),
        screenshot: nearest.screenshot,
      }
    : undefined;
}
