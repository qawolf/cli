// oxlint-disable eslint/max-lines -- Keep authorization, artifact fetch, and rendering order visible in the command handler.

import { basename } from "node:path";

import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import type { z } from "zod";

import { failureFields } from "~/shell/platform/requestWithRetry.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";

import { downloadLogTail, downloadTrace } from "./download.js";
import { loadInvestigationParser } from "./lazyParser.js";
import type {
  ArtifactInput,
  InspectType,
  InvestigationRequest,
  InvestigationResult,
} from "./types.js";

export type AttemptArtifacts = z.infer<
  typeof publicContractsV1.attempt.get.output
>;

export type InspectOptions = {
  actionId?: string;
  attemptId: string;
  endTimeMs?: string;
  endTimestamp?: string;
  evidenceId?: string;
  format: "html" | "text";
  limit: string;
  method?: string;
  outputFile?: string;
  requestId?: string;
  screenshotId?: string;
  snapshotId?: string;
  source?: "qawolfTraceCollection" | "serverConsole";
  startTimeMs?: string;
  startTimestamp?: string;
  status?: string;
  type: InspectType;
  urlContains?: string;
};

function artifactUnavailable(status: "not-captured" | "signing-failed") {
  return { status } as const;
}

export async function loadSummaryArtifacts(
  value: AttemptArtifacts,
): Promise<{ logs: ArtifactInput; trace: ArtifactInput }> {
  if (value.artifactStatus !== "signed") {
    const unavailable = artifactUnavailable(value.artifactStatus);
    return { logs: unavailable, trace: unavailable };
  }
  const [logs, trace] = await Promise.all([
    value.artifacts.logsUrl
      ? downloadLogTail(value.artifacts.logsUrl)
      : artifactUnavailable("not-captured"),
    value.artifacts.traceUrl
      ? downloadTrace(value.artifacts.traceUrl)
      : artifactUnavailable("not-captured"),
  ]);
  return { logs, trace };
}

export async function loadInspectArtifact(
  value: AttemptArtifacts,
  type: InspectType,
): Promise<{ logs: ArtifactInput; trace: ArtifactInput }> {
  const inactive = artifactUnavailable("not-captured");
  if (value.artifactStatus !== "signed") {
    const unavailable = artifactUnavailable(value.artifactStatus);
    return type === "log"
      ? { logs: unavailable, trace: inactive }
      : { logs: inactive, trace: unavailable };
  }
  if (type === "log") {
    return {
      logs: value.artifacts.logsUrl
        ? await downloadLogTail(value.artifacts.logsUrl)
        : inactive,
      trace: inactive,
    };
  }
  return {
    logs: inactive,
    trace: value.artifacts.traceUrl
      ? await downloadTrace(value.artifacts.traceUrl)
      : inactive,
  };
}

const maxInspectLimit = 100;

function numberFlag(
  value: string | undefined,
  name: string,
  options: { integer?: boolean; max?: number; min?: number } = {},
): number | undefined | { error: string } {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (
    !Number.isFinite(parsed) ||
    (options.integer === true && !Number.isInteger(parsed)) ||
    (options.min !== undefined && parsed < options.min)
  )
    return { error: `Invalid ${name}: ${value}.` };
  if (options.max !== undefined && parsed > options.max)
    return { error: `${name} must be at most ${options.max}, got ${value}.` };
  return parsed;
}

function timestampFlag(
  value: string | undefined,
  name: string,
): { error: string } | undefined {
  if (value === undefined || !Number.isNaN(Date.parse(value))) return undefined;
  return {
    error: `Invalid ${name}: ${value}. Use an ISO 8601 timestamp such as 2026-01-31T12:00:00Z.`,
  };
}

function validateInspect(options: InspectOptions): CommandResult {
  if (options.type === "action" && !options.actionId)
    return { error: "--action requires an evidence ID." };
  if (options.type === "request" && !options.requestId)
    return { error: "--request requires an evidence ID." };
  if (options.type === "snapshot" && !options.snapshotId)
    return { error: "--snapshot requires an evidence ID." };
  if (options.type === "screenshot" && !options.screenshotId)
    return { error: "--screenshot requires an evidence ID." };
  if (options.format === "html" && options.type !== "snapshot")
    return { error: "--format html is supported only with --snapshot." };
  if (options.type === "screenshot" && !options.outputFile)
    return {
      error: "--output-file is required for screenshot evidence.",
    };
  if (
    options.outputFile &&
    options.format !== "html" &&
    options.type !== "screenshot"
  )
    return {
      error:
        "--output-file is supported only with --snapshot and --format html, or with --screenshot.",
    };
  return undefined;
}

function renderText(result: Record<string, unknown>): string {
  return JSON.stringify(result, undefined, 2);
}

async function fetchAttempt(ctx: AuthCommandContext, attemptId: string) {
  return ctx.platformClient.callPublicApi(publicContractsV1.attempt.get, {
    attemptId,
  });
}

export async function handleInvestigationSummary(
  ctx: AuthCommandContext,
  attemptId: string,
): Promise<CommandResult> {
  const authorized = await fetchAttempt(ctx, attemptId);
  if (!authorized.ok) return failureFields(authorized);
  const artifacts = await loadSummaryArtifacts(authorized.value);
  const parser = await loadInvestigationParser();
  const evidence = await parser.investigate({
    artifacts,
    attempt: authorized.value.attempt,
    flowId: authorized.value.flowId,
    mode: "summary",
    runId: authorized.value.runId,
  });
  const result = {
    ...authorized.value,
    artifacts: undefined,
    evidence,
  };
  ctx.ui.output(result, renderText(result));
  return undefined;
}

export async function handleInvestigationInspect(
  ctx: AuthCommandContext,
  options: InspectOptions,
): Promise<CommandResult> {
  const invalid = validateInspect(options);
  if (invalid) return invalid;
  if (options.outputFile && (await ctx.fs.pathExists(options.outputFile)))
    return {
      error: `Refusing to overwrite existing file: ${options.outputFile}`,
    };

  const limit = numberFlag(options.limit, "--limit", {
    integer: true,
    max: maxInspectLimit,
    min: 1,
  });
  if (typeof limit !== "number") return limit;
  const startTimeMilliseconds = numberFlag(
    options.startTimeMs,
    "--start-time-ms",
  );
  if (typeof startTimeMilliseconds === "object") return startTimeMilliseconds;
  const endTimeMilliseconds = numberFlag(options.endTimeMs, "--end-time-ms");
  if (typeof endTimeMilliseconds === "object") return endTimeMilliseconds;
  const status = numberFlag(options.status, "--status", {
    integer: true,
    min: 0,
  });
  if (typeof status === "object") return status;
  const timestampError =
    timestampFlag(options.startTimestamp, "--start-timestamp") ??
    timestampFlag(options.endTimestamp, "--end-timestamp");
  if (timestampError) return timestampError;

  const authorized = await fetchAttempt(ctx, options.attemptId);
  if (!authorized.ok) return failureFields(authorized);
  const artifacts = await loadInspectArtifact(authorized.value, options.type);
  const request: InvestigationRequest = {
    artifacts,
    attempt: authorized.value.attempt,
    flowId: authorized.value.flowId,
    inspect: {
      actionId: options.actionId,
      endTimeMilliseconds,
      endTimestamp: options.endTimestamp,
      evidenceId: options.evidenceId,
      format: options.format,
      limit,
      method: options.method,
      requestId: options.requestId,
      screenshotId: options.screenshotId,
      snapshotId: options.snapshotId,
      source: options.source,
      startTimeMilliseconds,
      startTimestamp: options.startTimestamp,
      status,
      type: options.type,
      urlContains: options.urlContains,
    },
    mode: "inspect",
    runId: authorized.value.runId,
  };
  const parser = await loadInvestigationParser();
  const parsed = await parser.investigate(request);
  return outputInvestigationInspection(ctx, options, parsed);
}

export async function outputInvestigationInspection(
  ctx: Pick<AuthCommandContext, "fs" | "ui">,
  options: InspectOptions,
  parsed: InvestigationResult,
): Promise<CommandResult> {
  const { binary, ...result } = parsed;
  if (options.outputFile) {
    if (!binary)
      return {
        error: "The requested evidence did not contain exportable data.",
      };
    const written = await ctx.fs.writeFileExclusive(
      options.outputFile,
      Buffer.from(binary.bytesBase64, "base64"),
      { mode: 0o600 },
    );
    if (!written)
      return {
        error: `Refusing to overwrite existing file: ${options.outputFile}`,
      };
    const output = { ...result, outputFile: options.outputFile };
    ctx.ui.output(
      output,
      `${renderText(result)}\nSaved ${binary.extension}: ${basename(options.outputFile)}`,
    );
    return undefined;
  }
  if (binary?.extension === "html") {
    const html = Buffer.from(binary.bytesBase64, "base64").toString("utf8");
    ctx.ui.output({ ...result, html }, html);
    return undefined;
  }
  ctx.ui.output(result, renderText(result));
  return undefined;
}
