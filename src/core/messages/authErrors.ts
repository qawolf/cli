import { formatSeconds } from "~/core/formatSeconds.js";

/** Failure text shared by the auth, identity, request and bundle paths. */
export const authErrorMessages = {
  identity: {
    invalidOrUnauthorized: "API key is invalid or unauthorized",
    unexpectedFormat: "Could not verify API key: unexpected response format",
    couldNotVerify: (detail: string, status: number) =>
      `Could not verify API key: ${detail || `HTTP ${status}`}`,
    couldNotVerifyNetwork: (cause: string) =>
      `Could not verify API key: ${cause}`,
    timedOut: (timeoutMs: number) =>
      `Could not verify API key: the QA Wolf API did not answer within ${formatSeconds(timeoutMs)}.`,
  },
  request: {
    rejected401: (noun: string | undefined) =>
      `QA Wolf API rejected the${noun ? ` ${noun}` : ""} request (HTTP 401). Check your API key.`,
    rejected402: (noun: string | undefined) =>
      `QA Wolf API refused the${noun ? ` ${noun}` : ""} request (HTTP 402): billing prevented it.`,
    rejected403: (noun: string | undefined) =>
      `QA Wolf API rejected the${noun ? ` ${noun}` : ""} request (HTTP 403). Check that your API key has access to this environment.`,
    /**
     * A 404 is answered by what the request named, because almost none of them
     * are about an environment. Only `notFound404Environment` keeps the wording
     * that blames one, and only routes that carry an environment reach it.
     */
    notFound404Environment: (noun: string | undefined) =>
      `QA Wolf API could not find ${noun ? `${noun} for that environment` : "that environment"} (HTTP 404). Check the --env value.`,
    notFound404Runner: (runnerId: string | undefined) =>
      runnerId === undefined
        ? "That runner is not running (HTTP 404). Launch one with qawolf runner launch --id <id>, or name a running one with --runner."
        : `Runner ${runnerId} is not running (HTTP 404). Launch it with qawolf runner launch --id ${runnerId}, or send this to a different runner with --runner.`,
    /** Why a runner is gone, when the platform did not say. */
    runnerIsGone:
      "It was never launched, or it has since been terminated or idled out.",
    notFound404Run: (runId: string | undefined) =>
      `QA Wolf has no run ${runId ?? "by that id"} on this team (HTTP 404).`,
    /** Why a run id that exists can still be unknown to the platform. */
    runIdMayBeRunnerLocal: (runId: string | undefined) =>
      `A run id printed by qawolf runner run belongs to that runner rather than to the platform, so this command cannot resolve it. Read that run with qawolf runner events run-status --run ${runId ?? "<id>"}.`,
    notFound404: (noun: string | undefined) =>
      `QA Wolf API could not find ${noun ?? "what the request named"} (HTTP 404).`,
    failedWithStatus: (status: number, noun: string | undefined) =>
      `QA Wolf API${noun ? ` ${noun}` : ""} request failed (HTTP ${status}).`,
    networkUnreachable: (baseUrl: string, noun: string | undefined) =>
      `Could not reach the QA Wolf API at ${baseUrl}${noun ? ` to fetch ${noun}` : ""}. Check your network connection and QAWOLF_HOST_URL.`,
    timedOut: (timeoutMs: number, noun: string | undefined) =>
      `The QA Wolf API${noun ? ` ${noun}` : ""} request timed out after ${formatSeconds(timeoutMs)}. The work may still be finishing on the platform.`,
    unexpectedResponse: (noun: string | undefined) =>
      `Unexpected${noun ? ` ${noun}` : ""} response from the QA Wolf API.`,
  },
  workos: {
    unexpectedResponse: "WorkOS returned an unexpected response",
    unexpectedResponseWithStatus: (status: number) =>
      `WorkOS returned an unexpected response (HTTP ${status})`,
    unreachable: (detail: string) => `Could not reach WorkOS: ${detail}`,
    redirected:
      "WorkOS answered with a redirect, which the CLI does not follow for a sign-in request",
    noClientForSession: "This session names no WorkOS client",
  },
  bundle: {
    linkExpired:
      "The flow bundle download link has expired. Please run `qawolf flows pull` again to refresh.",
    failedWithStatus: (status: number) =>
      `Could not download the flow bundle (HTTP ${status}).`,
    networkUnreachable:
      "Could not reach the flow bundle storage. Check your network connection and try again.",
    timedOut: (timeoutMs: number) =>
      `Downloading the flow bundle stalled — no data arrived for ${formatSeconds(timeoutMs)}. Please try again.`,
    malformed:
      "The flow bundle download was malformed. Please run `qawolf flows pull` again.",
  },
} as const;
