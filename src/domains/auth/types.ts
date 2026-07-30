// "keychain" = OS credential store (macOS Keychain, Windows Credential Manager, etc.)
// "file"     = fallback JSON file in the config directory
export type StorageSource = "keychain" | "file";

// "env" = QAWOLF_API_KEY environment variable
type ApiKeySource = "env" | StorageSource;

export type ApiKeyResult = {
  key: string;
  source: ApiKeySource;
};

export type LoadApiKeyResult =
  | { found: true; key: string; source: StorageSource }
  | { found: false; errors?: { keychain?: string; file?: string } };

export type ValidateApiKeyResult =
  | { valid: true }
  | { valid: false; error: string };
