import { z } from "zod";

import type { StorageSource } from "~/lib/auth/types.js";

export const credentialsFileSchema = z.object({
  apiKey: z.string().min(1),
});

export type CredentialsFile = z.infer<typeof credentialsFileSchema>;

export type SaveApiKeyResult = {
  keychain: { stored: "keychain" };
  file: { stored: "file"; keychainError: string };
}[StorageSource];

type DeleteOutcomeMap = {
  keychain: "deleted" | "unavailable";
  file: "deleted" | "not-found";
};

export type DeleteApiKeyResult = { [K in StorageSource]: DeleteOutcomeMap[K] };
