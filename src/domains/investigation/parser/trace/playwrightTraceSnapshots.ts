import { listTraceActions } from "./playwrightTraceActions.js";
import { serializeSnapshotHtml } from "./playwrightTraceSnapshotSerialize.js";
import type {
  Bounded,
  PlaywrightTrace,
  TraceSnapshot,
} from "./playwrightTraceTypes.js";
import { traceLimits } from "./playwrightTraceTypes.js";
import { bounded } from "./playwrightTraceUtils.js";

function phase(name: string): TraceSnapshot["phase"] {
  if (name.startsWith("before@")) return "before";
  if (name.startsWith("input@")) return "input";
  if (name.startsWith("after@")) return "after";
  return "other";
}

export function listTraceSnapshots(
  trace: PlaywrightTrace,
  options: {
    actionId?: string;
    frameId?: string;
    limit?: number;
    pageId?: string;
    phase?: TraceSnapshot["phase"];
  } = {},
): Bounded<TraceSnapshot> {
  const actions = listTraceActions(trace, {
    limit: Number.MAX_SAFE_INTEGER,
  }).items;
  const actionsByStreamAndCall = new Map(
    actions.map((action) => [
      `${action.streamId}\u0000${action.callId}`,
      action,
    ]),
  );
  const snapshots = trace.streams
    .flatMap((stream) =>
      stream.events.flatMap((event, index) => {
        const value = event.snapshot;
        if (event.type !== "frame-snapshot" || !value) return [];
        const action = value.callId
          ? actionsByStreamAndCall.get(`${stream.id}\u0000${value.callId}`)
          : undefined;
        return [
          {
            actionId: action?.id,
            frameId: value.frameId,
            id: `${stream.id}:snapshot:${index}`,
            isMainFrame: value.isMainFrame,
            name: value.snapshotName,
            pageId: value.pageId,
            phase: phase(value.snapshotName),
            streamId: stream.id,
            timestamp: value.timestamp,
            url: value.frameUrl,
          },
        ];
      }),
    )
    .filter(
      (item) =>
        (options.actionId === undefined ||
          item.actionId === options.actionId) &&
        (options.frameId === undefined || item.frameId === options.frameId) &&
        (options.pageId === undefined || item.pageId === options.pageId) &&
        (options.phase === undefined || item.phase === options.phase),
    );
  return bounded(snapshots, options.limit ?? traceLimits.maxItems, {
    incomplete: trace.incomplete,
    malformed: trace.malformedLineCount,
  });
}

export function reconstructSnapshotHtml(
  snapshots: unknown[],
  snapshotIndex: number,
  options: { maxBytes?: number; maxDepth?: number; maxNodes?: number } = {},
): unknown {
  return serializeSnapshotHtml({
    filterStyles: false,
    maxBytes: options.maxBytes ?? traceLimits.maxBodyBytes,
    ...(options.maxDepth !== undefined && { maxDepth: options.maxDepth }),
    ...(options.maxNodes !== undefined && { maxNodes: options.maxNodes }),
    snapshotIndex,
    snapshots,
  }).html;
}

export function readTraceSnapshot(
  trace: PlaywrightTrace,
  snapshotId: string,
  options: { maxBytes?: number } = {},
):
  | {
      html: unknown;
      snapshot: TraceSnapshot;
      snapshotIndex: number;
      truncated: boolean;
    }
  | undefined {
  const metadata = listTraceSnapshots(trace, {
    limit: Number.MAX_SAFE_INTEGER,
  }).items.find((item) => item.id === snapshotId);
  if (!metadata) return undefined;
  const stream = trace.streams.find((item) => item.id === metadata.streamId);
  if (!stream) return undefined;
  const frameEvents = stream.events.filter(
    (event) =>
      event.type === "frame-snapshot" &&
      event.snapshot?.frameId === metadata.frameId,
  );
  const sourceIndex = Number(snapshotId.slice(snapshotId.lastIndexOf(":") + 1));
  const sourceEvent = stream.events[sourceIndex];
  if (!sourceEvent) return undefined;
  const snapshotIndex = frameEvents.indexOf(sourceEvent);
  if (snapshotIndex === -1) return undefined;
  const snapshots = frameEvents.map((event) => event.snapshot?.html);
  const maxBytes = options.maxBytes ?? traceLimits.maxBodyBytes;
  const reconstructed = serializeSnapshotHtml({
    filterStyles: true,
    maxBytes,
    snapshotIndex,
    snapshots,
  });
  return {
    html: reconstructed.html,
    snapshot: metadata,
    snapshotIndex,
    truncated: reconstructed.truncated,
  };
}
