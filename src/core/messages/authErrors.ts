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
    notUserSession:
      "The QA Wolf API accepted the token but did not describe a user session",
  },
  request: {
    rejected401: (noun: string | undefined) =>
      `QA Wolf API rejected the${noun ? ` ${noun}` : ""} request (HTTP 401). Check your API key.`,
    rejected402: (noun: string | undefined) =>
      `QA Wolf API refused the${noun ? ` ${noun}` : ""} request (HTTP 402): billing prevented it.`,
    rejected403: (noun: string | undefined) =>
      `QA Wolf API rejected the${noun ? ` ${noun}` : ""} request (HTTP 403). Check that your API key has access to this environment.`,
    notFound404: (noun: string | undefined) =>
      `QA Wolf API could not find ${noun ? `${noun} for that environment` : "that environment"} (HTTP 404). Check the --env value.`,
    failedWithStatus: (status: number, noun: string | undefined) =>
      `QA Wolf API${noun ? ` ${noun}` : ""} request failed (HTTP ${status}).`,
    networkUnreachable: (baseUrl: string, noun: string | undefined) =>
      `Could not reach the QA Wolf API at ${baseUrl}${noun ? ` to fetch ${noun}` : ""}. Check your network connection and QAWOLF_HOST_URL.`,
    timedOut: (timeoutMs: number, noun: string | undefined) =>
      `The QA Wolf API${noun ? ` ${noun}` : ""} request timed out after ${formatSeconds(timeoutMs)}. The work may still be finishing on the platform.`,
    unexpectedResponse: (noun: string | undefined) =>
      `Unexpected${noun ? ` ${noun}` : ""} response from the QA Wolf API.`,
  },
  authConfig: {
    halfConfigured: (missingField: string) =>
      `This QA Wolf deployment publishes an incomplete sign-in configuration: ${missingField} is missing.`,
  },
  workos: {
    unexpectedResponse: "WorkOS returned an unexpected response",
    unexpectedResponseWithStatus: (status: number) =>
      `WorkOS returned an unexpected response (HTTP ${status})`,
    unreachable: (detail: string) => `Could not reach WorkOS: ${detail}`,
    redirected:
      "WorkOS answered with a redirect, which the CLI does not follow for a sign-in request",
    noRefreshToken: "WorkOS returned no refresh token",
    resourceNotRegistered: (resource: string) =>
      `WorkOS does not recognise ${resource} as a registered resource. The QA Wolf deployment's API URL has to be registered with its sign-in provider before browser sign-in can work.`,
    tokenNotBound: (reason: string) =>
      `WorkOS returned a token the QA Wolf API would not accept (${reason})`,
    metadata: {
      unavailable: (status: number) =>
        `The sign-in provider did not serve its authorization server metadata (HTTP ${status})`,
      issuerMismatch: (expected: string, actual: string) =>
        `The sign-in provider's metadata names issuer ${actual}, but the deployment configured ${expected}`,
      missingEndpoint: (name: string) =>
        `The sign-in provider's metadata advertises no ${name} endpoint`,
      foreignEndpoint: (name: string) =>
        `The sign-in provider's metadata puts the ${name} endpoint on a different origin from the issuer`,
    },
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
