import { z } from "zod";

import type { StorageSource } from "../types.js";

export const credentialsFileSchema = z.object({
  apiKey: z.string().min(1),
});

export type CredentialsFile = z.infer<typeof credentialsFileSchema>;

// Derived from StorageSource — adding a new source requires adding a variant
export type SaveApiKeyResult = {
  keychain: { stored: "keychain" };
  file: { stored: "file"; keychainError: string };
}[StorageSource];

// Derived from StorageSource — adding a new source requires adding an outcome
export type DeleteOutcomeMap = {
  keychain: "deleted" | "unavailable";
  file: "deleted" | "not-found";
};

export type DeleteApiKeyResult = { [K in StorageSource]: DeleteOutcomeMap[K] };
