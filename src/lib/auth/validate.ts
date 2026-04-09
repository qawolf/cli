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
  // Pattern:
  //   const response = await fetch(`${baseUrl}/api/auth/me`, {
  //     headers: { Authorization: `Bearer ${apiKey}` },
  //   });
  //   if (!response.ok) return { valid: false, error: `API returned ${response.status}` };
  //   const data = await response.json();
  //   return { valid: true, teamName: data.teamName };

  return { valid: true, teamName: "unknown" };
}
