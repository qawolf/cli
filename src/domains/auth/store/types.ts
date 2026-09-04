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
  /** WorkOS organization the session is scoped to; refreshes are pinned to it. */
  organizationId: z.string().min(1).optional(),
  /** WorkOS client that issued the tokens; refreshes go back to it. */
  clientId: z.string().min(1).optional(),
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
