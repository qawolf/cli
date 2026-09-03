import type { DeviceTokens } from "~/core/deviceAuth/types.js";

// "keychain" = OS credential store (macOS Keychain, Windows Credential Manager, etc.)
// "file"     = fallback JSON file in the config directory
export type StorageSource = "keychain" | "file";

// "env"     = QAWOLF_API_KEY environment variable
// "browser" = access token from browser sign-in, held in either storage
type ApiKeySource = "env" | StorageSource | "browser";

export type ApiKeyResult = {
  key: string;
  source: ApiKeySource;
};

export type LoadApiKeyResult =
  | { found: true; key: string; source: StorageSource }
  | { found: false; errors?: { keychain?: string; file?: string } };

/**
 * What browser sign-in persists: the WorkOS tokens plus the workspace the
 * person chose. The workspace is a QA Wolf concept rather than a token field,
 * but it belongs to the same session and is cleared with it.
 */
export type StoredSession = DeviceTokens & {
  /**
   * WorkOS client that issued these tokens. A refresh token is only redeemable
   * against its issuing client, so the session records it rather than asking
   * the deployment again — which could answer differently if the CLI has since
   * been pointed elsewhere.
   */
  clientId: string | undefined;
};

export type LoadTokensResult =
  | { found: true; tokens: StoredSession; source: StorageSource }
  | { found: false; errors?: { keychain?: string; file?: string } };

export type ValidateApiKeyResult =
  | { valid: true }
  | { valid: false; error: string };
