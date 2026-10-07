import type { TraceEvent } from "./playwrightTraceTypes.js";
import { asObject } from "./playwrightTraceUtils.js";

export function normalizeTraceEvent(value: unknown): TraceEvent | undefined {
  const event = asObject(value);
  if (!event || typeof event.type !== "string") return undefined;
  const stringFields = [
    "callId",
    "class",
    "message",
    "messageType",
    "method",
    "pageId",
    "sha1",
    "text",
  ];
  const numberFields = [
    "endTime",
    "height",
    "startTime",
    "time",
    "timestamp",
    "width",
  ];
  if (
    stringFields.some(
      (key) => event[key] !== undefined && typeof event[key] !== "string",
    )
  )
    return undefined;
  if (
    numberFields.some(
      (key) => event[key] !== undefined && typeof event[key] !== "number",
    )
  )
    return undefined;
  const params =
    event.params === undefined ? undefined : asObject(event.params);
  if (
    event.params !== undefined &&
    (!params ||
      (params.expression !== undefined &&
        typeof params.expression !== "string") ||
      (params.selector !== undefined && typeof params.selector !== "string"))
  )
    return undefined;
  const error = event.error === undefined ? undefined : asObject(event.error);
  if (
    event.error !== undefined &&
    (!error || typeof error.message !== "string")
  )
    return undefined;
  const snapshot =
    event.snapshot === undefined ? undefined : asObject(event.snapshot);
  if (
    event.snapshot !== undefined &&
    (!snapshot ||
      typeof snapshot.frameId !== "string" ||
      typeof snapshot.frameUrl !== "string" ||
      typeof snapshot.snapshotName !== "string" ||
      (snapshot.callId !== undefined && typeof snapshot.callId !== "string") ||
      (snapshot.pageId !== undefined && typeof snapshot.pageId !== "string") ||
      (snapshot.isMainFrame !== undefined &&
        typeof snapshot.isMainFrame !== "boolean") ||
      (snapshot.timestamp !== undefined &&
        typeof snapshot.timestamp !== "number"))
  )
    return undefined;
  if (
    ((event.type === "before" || event.type === "after") &&
      typeof event.callId !== "string") ||
    (event.type === "frame-snapshot" && !snapshot) ||
    (event.type === "log" && typeof event.message !== "string") ||
    (event.type === "console" && typeof event.text !== "string") ||
    (event.type === "screencast-frame" && typeof event.sha1 !== "string")
  )
    return undefined;
  return {
    callId: typeof event.callId === "string" ? event.callId : undefined,
    class: typeof event.class === "string" ? event.class : undefined,
    endTime: typeof event.endTime === "number" ? event.endTime : undefined,
    error:
      error && typeof error.message === "string"
        ? { message: error.message }
        : undefined,
    height: typeof event.height === "number" ? event.height : undefined,
    message: typeof event.message === "string" ? event.message : undefined,
    messageType:
      typeof event.messageType === "string" ? event.messageType : undefined,
    method: typeof event.method === "string" ? event.method : undefined,
    pageId: typeof event.pageId === "string" ? event.pageId : undefined,
    params: params
      ? {
          expression:
            typeof params.expression === "string"
              ? params.expression
              : undefined,
          selector:
            typeof params.selector === "string" ? params.selector : undefined,
        }
      : undefined,
    sha1: typeof event.sha1 === "string" ? event.sha1 : undefined,
    snapshot: snapshot
      ? {
          callId:
            typeof snapshot.callId === "string" ? snapshot.callId : undefined,
          frameId: typeof snapshot.frameId === "string" ? snapshot.frameId : "",
          frameUrl:
            typeof snapshot.frameUrl === "string" ? snapshot.frameUrl : "",
          html: snapshot.html,
          isMainFrame:
            typeof snapshot.isMainFrame === "boolean"
              ? snapshot.isMainFrame
              : undefined,
          pageId:
            typeof snapshot.pageId === "string" ? snapshot.pageId : undefined,
          snapshotName:
            typeof snapshot.snapshotName === "string"
              ? snapshot.snapshotName
              : "",
          timestamp:
            typeof snapshot.timestamp === "number"
              ? snapshot.timestamp
              : undefined,
        }
      : undefined,
    startTime:
      typeof event.startTime === "number" ? event.startTime : undefined,
    text: typeof event.text === "string" ? event.text : undefined,
    time: typeof event.time === "number" ? event.time : undefined,
    timestamp:
      typeof event.timestamp === "number" ? event.timestamp : undefined,
    type: event.type,
    width: typeof event.width === "number" ? event.width : undefined,
  };
}
