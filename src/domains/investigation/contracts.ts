import { z } from "zod";

const attemptStatus = z.enum([
  "passed",
  "failed",
  "canceled",
  "aborted",
  "skipped",
]);

const attempt = z
  .object({
    attemptId: z.string(),
    completedAt: z.string().optional(),
    createdAt: z.string(),
    error: z.string().optional(),
    kind: z.enum(["automated", "manual"]),
    startedAt: z.string().optional(),
    status: attemptStatus,
  })
  .loose();

const attemptNeighbor = z
  .object({ attemptId: z.string(), status: attemptStatus })
  .loose();

export const getAttemptArtifactsContract = {
  input: z.object({ attemptId: z.string().min(1) }),
  kind: "read" as const,
  name: "run.getAttemptArtifacts",
  output: z
    .object({
      artifactStatus: z.enum(["signed", "not-captured", "signing-failed"]),
      artifacts: z
        .object({
          logsUrl: z.url().optional(),
          traceUrl: z.url().optional(),
          videoUrl: z.url().optional(),
        })
        .loose(),
      attempt,
      flowId: z.string(),
      flowStatus: z.enum(["queued", "running", "passed", "failed", "canceled"]),
      retryContext: z
        .object({
          currentOrdinal: z.number().int().positive(),
          next: attemptNeighbor.optional(),
          previous: attemptNeighbor.optional(),
          total: z.number().int().positive(),
        })
        .loose(),
      runId: z.string(),
      runStatus: z.enum(["queued", "running", "passed", "failed", "canceled"]),
    })
    .loose(),
};

const discoveredAttempt = z
  .object({
    attemptId: z.string(),
    completedAt: z.string().optional(),
    kind: z.enum(["automated", "manual"]),
    startedAt: z.string().optional(),
    status: attemptStatus,
  })
  .loose();

export const discoverInvestigationsContract = {
  input: z.object({ runId: z.string().min(1) }),
  kind: "read" as const,
  name: "run.get",
  output: z
    .object({
      flows: z.array(
        z
          .object({
            attempts: z.array(discoveredAttempt).optional(),
            flowId: z.string(),
            name: z.string(),
            status: z.string(),
          })
          .loose(),
      ),
      runId: z.string(),
      status: z.string(),
    })
    .loose(),
};

export type AttemptArtifacts = z.infer<
  typeof getAttemptArtifactsContract.output
>;
