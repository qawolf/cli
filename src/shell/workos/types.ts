import { z } from "zod";

/** WorkOS hosts the device endpoints; the CLI never sends a secret to them. */
export const defaultWorkosBaseUrl = "https://api.workos.com";

/** Interval the device grant assumes when the server states none. */
export const defaultIntervalSec = 5;

export type WorkosDeps = {
  fetch: typeof globalThis.fetch;
  baseUrl: string;
  clientId: string;
};

export const deviceAuthorizationBody = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verification_uri: z.string().min(1),
  verification_uri_complete: z.string().min(1).optional(),
  expires_in: z.number().int().positive(),
  interval: z.number().int().positive().optional(),
});

export const deviceTokenBody = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  user: z.object({ email: z.string().min(1) }),
  organization_id: z.string().min(1).optional(),
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
