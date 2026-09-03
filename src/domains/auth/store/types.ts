import { z } from "zod";

import type { StorageSource } from "~/domains/auth/types.js";

export const credentialsFileSchema = z.object({
  apiKey: z.string().min(1),
});

export type CredentialsFile = z.infer<typeof credentialsFileSchema>;

export const oauthTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  /** Epoch ms. Absent when the access token carried no readable expiry. */
  expiresAt: z.number().int().optional(),
  email: z.string().min(1),
  /** WorkOS organization the token was granted for. */
  organizationId: z.string().min(1).optional(),
  /** The workspace the person chose to work in, inside that organization. */
  workspaceId: z.string().min(1).optional(),
  /** Where the tokens came from and what they are bound to; refreshes reuse all three. */
  issuer: z.string().min(1),
  clientId: z.string().min(1),
  resource: z.string().min(1),
});

/**
 * A token pair without the full binding: what a session from before Connect
 * looks like, and what any partial record looks like. Recognised only so its
 * presence can be reported as "sign in again" rather than as corruption.
 */
export const legacyTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

export type SaveCredentialResult = {
  keychain: { stored: "keychain" };
  file: { stored: "file"; keychainError: string };
}[StorageSource];

type DeleteOutcomeMap = {
  keychain: "deleted" | "unavailable";
  file: "deleted" | "not-found";
};

export type DeleteCredentialResult = {
  [K in StorageSource]: DeleteOutcomeMap[K];
};
