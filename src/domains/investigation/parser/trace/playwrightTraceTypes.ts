// oxlint-disable eslint/max-lines -- The lazy parser publishes one internal trace model shared by all projections.

import type JSZip from "jszip";

export type TraceEvent = {
  callId?: string | undefined;
  class?: string | undefined;
  endTime?: number | undefined;
  error?: { message: string } | undefined;
  height?: number | undefined;
  message?: string | undefined;
  messageType?: string | undefined;
  method?: string | undefined;
  pageId?: string | undefined;
  params?:
    | { expression?: string | undefined; selector?: string | undefined }
    | undefined;
  sha1?: string | undefined;
  snapshot?:
    | {
        callId?: string | undefined;
        frameId: string;
        frameUrl: string;
        html: unknown;
        isMainFrame?: boolean | undefined;
        pageId?: string | undefined;
        snapshotName: string;
        timestamp?: number | undefined;
      }
    | undefined;
  startTime?: number | undefined;
  text?: string | undefined;
  time?: number | undefined;
  timestamp?: number | undefined;
  type: string;
  width?: number | undefined;
};
export type TraceStackFrame = [number, number, number, ...string[]];
export type TraceStacks = {
  files: string[];
  stacks: [number, TraceStackFrame[]][];
};
export type TraceStream = {
  events: TraceEvent[];
  id: string;
  incomplete: boolean;
  malformedLineCount: number;
  stacks: TraceStacks;
};
export type PlaywrightTrace = {
  archive: JSZip;
  artifactBudget: {
    decodedBytes: number;
    events: number;
    members: number;
  };
  incomplete: boolean;
  limits: TraceLimits;
  malformedLineCount: number;
  streams: TraceStream[];
};
export type TraceReadResult =
  | { status: "missing" }
  | { status: "storage-unavailable" }
  | {
      incomplete: boolean;
      malformedLineCount: number;
      reason: "archive-too-large" | "invalid-zip" | "no-trace-stream";
      status: "malformed";
    }
  | { status: "ready" | "incomplete"; trace: PlaywrightTrace };
export type TraceLimits = {
  maxArchiveBytes: number;
  maxBodyBytes: number;
  maxEntryBytes: number;
  maxEvents: number;
  maxItems: number;
  maxMembers: number;
  maxTextBytes: number;
  maxTotalDecodedBytes: number;
};
export const traceLimits: TraceLimits = {
  maxArchiveBytes: 50 * 1024 * 1024,
  maxBodyBytes: 256 * 1024,
  maxEntryBytes: 16 * 1024 * 1024,
  maxEvents: 100_000,
  maxItems: 100,
  maxMembers: 128,
  maxTextBytes: 8 * 1024,
  maxTotalDecodedBytes: 64 * 1024 * 1024,
};
export type Coverage = {
  incomplete: boolean;
  malformed: number;
  returned: number;
  total: number;
  truncated: boolean;
};
export type Bounded<Item> = { coverage: Coverage; items: Item[] };
export type TraceAction = {
  apiName: string;
  callId: string;
  endTime: number | undefined;
  errorMessage: string | undefined;
  expression: string | undefined;
  id: string;
  occurrence: number;
  pageId: string | undefined;
  selector: string | undefined;
  startTime: number | undefined;
  streamId: string;
};
export type StackFrame = {
  compiledLine: number;
  file: string;
  functionName: string | undefined;
};
export type FailureStack = {
  action: TraceAction;
  errorMessage: string;
  frames: StackFrame[];
};
export type TraceSnapshot = {
  actionId: string | undefined;
  frameId: string;
  id: string;
  isMainFrame: boolean | undefined;
  name: string;
  pageId: string | undefined;
  phase: "after" | "before" | "input" | "other";
  streamId: string;
  timestamp: number | undefined;
  url: string;
};
export type TraceScreenshot = {
  height: number | undefined;
  id: string;
  pageId: string | undefined;
  resourceName: string;
  streamId: string;
  timestamp: number | undefined;
  width: number | undefined;
};
export type TraceNetworkEntry = {
  bodyAvailable: boolean;
  bodyResourceName: string | undefined;
  durationMilliseconds: number | undefined;
  failureText: string | undefined;
  frameId: string | undefined;
  id: string;
  method: string;
  pageId: string | undefined;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  startedAtMilliseconds: number | undefined;
  status: number | undefined;
  streamId: string;
  url: string;
};
export type TraceConsoleEntry = {
  id: string;
  message: string;
  pageId: string | undefined;
  streamId: string;
  time: number | undefined;
  type: string;
};
export type TraceActionLog = TraceConsoleEntry & {
  actionId: string | undefined;
};
