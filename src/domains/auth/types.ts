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
 * What browser sign-in persists: the token pair, who it belongs to, and what
 * it is bound to. A refresh token is only redeemable against its issuer and
 * client, and only yields a usable token when it asks for the same resource,
 * so all three ride with the session rather than being asked of the
 * deployment again — which could answer differently once the CLI is pointed
 * elsewhere.
 */
export type StoredSession = DeviceTokens & {
  /** From the API's identity response, not from the token. */
  email: string;
  issuer: string;
  clientId: string;
  /** The API resource the tokens are bound to; also names the deployment. */
  resource: string;
};

export type LoadTokensResult =
  | { found: true; tokens: StoredSession; source: StorageSource }
  | { found: false; errors?: { keychain?: string; file?: string } };

export type ValidateApiKeyResult =
  | { valid: true }
  | { valid: false; error: string };
