import { z } from "zod";

/** Interval the device grant assumes when the server states none. */
export const defaultIntervalSec = 5;

/**
 * `offline_access` is what earns a refresh token, and the refresh is the only
 * exchange observed to yield a token bound to the API resource.
 */
export const deviceScope = "openid profile email offline_access";

/** Where the issuer's metadata says the two grants live. */
export type IssuerEndpoints = {
  deviceAuthorization: string;
  token: string;
};

/**
 * Everything a Connect request needs. The CLI is a public client: there is no
 * secret here, and none is ever sent.
 */
export type WorkosDeps = {
  fetch: typeof globalThis.fetch;
  clientId: string;
  /** The API resource every grant asks to be bound to. */
  resource: string;
  endpoints: IssuerEndpoints;
};

export const authorizationServerMetadata = z.object({
  issuer: z.string().min(1),
  device_authorization_endpoint: z.string().min(1).optional(),
  token_endpoint: z.string().min(1).optional(),
});

export const deviceAuthorizationBody = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verification_uri: z.string().min(1),
  verification_uri_complete: z.string().min(1).optional(),
  expires_in: z.number().int().positive(),
  interval: z.number().int().positive().optional(),
});

/**
 * A plain OAuth token response. The refresh token is optional on the wire and
 * required by the CLI, which reports its absence as its own failure rather
 * than as an unrecognised body.
 */
export const connectTokenBody = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
});

export const oauthErrorBody = z.object({
  error: z.string().min(1),
  error_description: z.string().min(1).optional(),
});

/**
 * WorkOS authentication errors are shaped unlike the OAuth ones: `code` and
 * `message` rather than `error` and `error_description`. They cover
 * `organization_selection_required`, `mfa_enrollment`, `email_verification_required`
 * and friends. Parsed separately so such a response reads as what it is instead
 * of an unrecognised body.
 */
export const authenticationErrorBody = z.object({
  code: z.string().min(1),
  message: z.string().min(1).optional(),
});

export type AuthorizationResult<T> =
  | { ok: true; value: T }
  /**
   * `retryable` marks a failure the same request could survive. WorkOS
   * classifies 408, 429 and 5xx as transient and asks clients to retry the same
   * refresh token; only an OAuth `invalid_grant` means the session is gone.
   * Without this flag a dropped packet is indistinguishable from a revoked
   * credential, and the person is told to sign in again over a blip.
   */
  | { ok: false; error: string; retryable: boolean };
