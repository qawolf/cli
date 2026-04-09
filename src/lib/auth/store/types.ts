import { z } from "zod";

export const credentialsFileSchema = z.object({
  apiKey: z.string().min(1),
});

export type CredentialsFile = z.infer<typeof credentialsFileSchema>;

export type SaveApiKeyResult =
  | { stored: "keychain" }
  | { stored: "file"; keychainError: string };

export type DeleteApiKeyResult = {
  keychain: "deleted" | "unavailable";
  file: "deleted" | "not-found";
};
