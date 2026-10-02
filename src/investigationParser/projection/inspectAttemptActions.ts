import {
  type PlaywrightTrace,
  listTraceActionLogs,
  listTraceActions,
  listTraceNetwork,
  listTraceSnapshots,
} from "../trace/playwrightTrace.js";

import { chronologicallySortActions } from "./chronologicallySortActions.js";
import {
  type InspectionCommon,
  emptyInspectionCoverage,
  shapeInspectionAction,
} from "./inspectAttemptShared.js";

export function inspectActionTimeline(
  trace: PlaywrightTrace,
  common: InspectionCommon,
  target: { beforeActionId?: string; limit: number; type: "timeline" },
) {
  const listed = listTraceActions(trace, { limit: Number.MAX_SAFE_INTEGER });
  const actions = chronologicallySortActions(listed.items);
  const boundary = target.beforeActionId
    ? actions.findIndex((item) => item.id === target.beforeActionId)
    : actions.length;
  if (boundary === -1) {
    return {
      ...common,
      actions: [],
      coverage: { ...listed.coverage, returned: 0 },
      status: "not-found" as const,
      type: target.type,
    };
  }
  const start = Math.max(0, boundary - target.limit);
  const selected = actions.slice(start, boundary);
  const logs = listTraceActionLogs(trace, {
    limit: Number.MAX_SAFE_INTEGER,
    maxTextBytes: Number.MAX_SAFE_INTEGER,
  }).items;
  return {
    ...common,
    actions: selected.map((action) =>
      shapeInspectionAction(trace, action, logs),
    ),
    coverage: {
      ...listed.coverage,
      returned: selected.length,
      truncated: start > 0 || boundary < actions.length,
    },
    ...(start > 0 && selected[0] && { nextBeforeActionId: selected[0].id }),
    status: "available" as const,
    type: target.type,
  };
}

export async function inspectAction(
  trace: PlaywrightTrace,
  common: InspectionCommon,
  target: { actionId: string; type: "action" },
) {
  const actions = chronologicallySortActions(
    listTraceActions(trace, { limit: Number.MAX_SAFE_INTEGER }).items,
  );
  const index = actions.findIndex((item) => item.id === target.actionId);
  const action = actions[index];
  if (!action) {
    return {
      ...common,
      neighbors: [],
      requestIds: [],
      requestIdsCoverage: emptyInspectionCoverage,
      snapshotIds: [],
      snapshotIdsCoverage: emptyInspectionCoverage,
      status: "not-found" as const,
      type: target.type,
    };
  }
  const logs = listTraceActionLogs(trace, {
    limit: Number.MAX_SAFE_INTEGER,
    maxTextBytes: Number.MAX_SAFE_INTEGER,
  }).items;
  const neighborStart = Math.max(0, index - 2);
  const network = await listTraceNetwork(trace, {
    limit: Number.MAX_SAFE_INTEGER,
  });
  const streamRequests = network.items.filter(
    (request) =>
      request.streamId === action.streamId &&
      (action.pageId === undefined || request.pageId === action.pageId),
  );
  const relatedRequests = streamRequests.filter(
    (request) =>
      request.startedAtMilliseconds !== undefined &&
      action.startTime !== undefined &&
      request.startedAtMilliseconds >= action.startTime &&
      (action.endTime === undefined ||
        request.startedAtMilliseconds <= action.endTime),
  );
  const requestIds = relatedRequests.slice(0, 10).map((request) => request.id);
  const snapshots = listTraceSnapshots(trace, {
    actionId: target.actionId,
    limit: 20,
  });
  return {
    ...common,
    action: shapeInspectionAction(trace, action, logs),
    neighbors: actions
      .slice(neighborStart, index + 3)
      .filter((_, neighborIndex) => neighborIndex + neighborStart !== index)
      .map((neighbor) => shapeInspectionAction(trace, neighbor, logs)),
    requestIds,
    requestIdsCoverage: {
      ...network.coverage,
      returned: requestIds.length,
      total: relatedRequests.length,
      truncated:
        network.coverage.truncated ||
        relatedRequests.length > requestIds.length,
    },
    snapshotIds: snapshots.items.map((snapshot) => snapshot.id),
    snapshotIdsCoverage: snapshots.coverage,
    status: "available" as const,
    type: target.type,
  };
}
