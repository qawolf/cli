// oxlint-disable eslint/max-lines -- Keep cached action indexing and stable evidence IDs aligned with the platform reader.

import type {
  Bounded,
  FailureStack,
  PlaywrightTrace,
  StackFrame,
  TraceAction,
  TraceEvent,
} from "./playwrightTraceTypes.js";
import { traceLimits } from "./playwrightTraceTypes.js";
import { bounded } from "./playwrightTraceUtils.js";

const actionsCache = new WeakMap<
  PlaywrightTrace["streams"][number],
  ReturnType<typeof readActionsForStream>
>();

function shape(event: TraceEvent) {
  return {
    apiName:
      event.class && event.method
        ? `${event.class}.${event.method}`
        : "unknown action",
    expression: event.params?.expression,
    selector: event.params?.selector,
  };
}

function actionShapeKey(actionShape: ReturnType<typeof shape>): string {
  return JSON.stringify([
    actionShape.apiName,
    actionShape.expression,
    actionShape.selector,
  ]);
}

function actionsForStream(
  stream: PlaywrightTrace["streams"][number],
): { action: TraceAction; event: TraceEvent }[] {
  const cached = actionsCache.get(stream);
  if (cached) return cached;
  const actions = readActionsForStream(stream);
  actionsCache.set(stream, actions);
  return actions;
}

function readActionsForStream(
  stream: PlaywrightTrace["streams"][number],
): { action: TraceAction; event: TraceEvent }[] {
  const afterByCallId = new Map<string, TraceEvent>();
  for (const event of stream.events) {
    if (event.type === "after" && event.callId)
      afterByCallId.set(event.callId, event);
  }
  const occurrences = new Map<string, number>();
  return stream.events.flatMap((event) => {
    if (event.type !== "before" || !event.callId) return [];
    const actionShape = shape(event);
    const shapeKey = actionShapeKey(actionShape);
    const occurrence = occurrences.get(shapeKey) ?? 0;
    occurrences.set(shapeKey, occurrence + 1);
    const after = afterByCallId.get(event.callId);
    return [
      {
        action: {
          ...actionShape,
          callId: event.callId,
          endTime: after?.endTime,
          errorMessage: after?.error?.message,
          id: `${stream.id}:action:${event.callId}`,
          occurrence,
          pageId: event.pageId,
          startTime: event.startTime,
          streamId: stream.id,
        },
        event,
      },
    ];
  });
}

export function listTraceActions(
  trace: PlaywrightTrace,
  options: { limit?: number } = {},
): Bounded<TraceAction> {
  const actions = trace.streams.flatMap((stream) =>
    actionsForStream(stream).map(({ action }) => action),
  );
  return bounded(actions, options.limit ?? traceLimits.maxItems, {
    incomplete: trace.incomplete,
    malformed: trace.malformedLineCount,
  });
}

function repoPath(compiledFile: string): string | undefined {
  const marker = "generatedProgram/";
  const index = compiledFile.indexOf(marker);
  if (index === -1) return undefined;
  const relative = compiledFile.slice(index + marker.length);
  return relative.startsWith("src/")
    ? relative.replace(/\.js$/, ".ts")
    : undefined;
}

export function readTraceActionStack(
  trace: PlaywrightTrace,
  action: TraceAction,
): StackFrame[] {
  const stream = trace.streams.find(
    (candidate) => candidate.id === action.streamId,
  );
  const callNumber = /^call@(\d+)$/.exec(action.callId)?.[1];
  const rawFrames =
    callNumber === undefined
      ? []
      : (stream?.stacks.stacks.find(([id]) => id === Number(callNumber))?.[1] ??
        []);
  return rawFrames.flatMap(([fileIndex, line, , functionName]) => {
    const compiledFile = stream?.stacks.files[fileIndex];
    const file = compiledFile ? repoPath(compiledFile) : undefined;
    return file
      ? [{ compiledLine: line, file, functionName: functionName || undefined }]
      : [];
  });
}

export function readFailureStack(
  trace: PlaywrightTrace,
): FailureStack | undefined {
  const action = listTraceActions(trace, {
    limit: Number.MAX_SAFE_INTEGER,
  }).items.findLast((candidate) => candidate.errorMessage !== undefined);
  if (!action?.errorMessage) return undefined;
  return {
    action,
    errorMessage: action.errorMessage,
    frames: readTraceActionStack(trace, action),
  };
}
