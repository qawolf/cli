import type { ValidateApiKeyResult } from "./types.js";

/**
 * Validates a QA Wolf API key against the platform.
 *
 * TODO: Wire to actual QA Wolf endpoint when available.
 * Stub accepts any non-empty key.
 */
export async function validateApiKey(
  apiKey: string,
): Promise<ValidateApiKeyResult> {
  if (!apiKey.trim()) {
    return { valid: false, error: "API key is empty" };
  }

  // Stub — replace with real fetch call when endpoint is identified
  return { valid: true, teamName: "unknown" };
}
