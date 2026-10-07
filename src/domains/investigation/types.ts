export type ArtifactInput =
  | { bytes: Uint8Array; offset: number; status: "available" }
  | {
      status:
        | "expired-url"
        | "not-found"
        | "timed-out"
        | "too-large"
        | "unavailable";
    }
  | { status: "not-captured" | "signing-failed" };

export type InspectType =
  | "action"
  | "timeline"
  | "network"
  | "request"
  | "snapshot"
  | "screenshot"
  | "console"
  | "log";

export type InvestigationRequest = {
  artifacts: { logs: ArtifactInput; trace: ArtifactInput };
  attempt: {
    attemptId: string;
    error?: string | undefined;
    status: string;
  };
  flowId: string;
  inspect?: {
    actionId?: string | undefined;
    endTimeMilliseconds?: number | undefined;
    endTimestamp?: string | undefined;
    evidenceId?: string | undefined;
    format: "html" | "text";
    limit: number;
    method?: string | undefined;
    requestId?: string | undefined;
    screenshotId?: string | undefined;
    snapshotId?: string | undefined;
    source?: "qawolfTraceCollection" | "serverConsole" | undefined;
    startTimeMilliseconds?: number | undefined;
    startTimestamp?: string | undefined;
    status?: number | undefined;
    type: InspectType;
    urlContains?: string | undefined;
  };
  mode: "inspect" | "summary";
  runId: string;
};

export type InvestigationResult = Record<string, unknown> & {
  binary?: { bytesBase64: string; extension: "html" | "jpeg" };
};
