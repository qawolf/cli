// "keychain" = OS credential store (macOS Keychain, Windows Credential Manager, etc.)
// "file"     = fallback JSON file in the config directory
export type StorageSource = "keychain" | "file";

// "env" = QAWOLF_API_KEY environment variable
export type ApiKeySource = "env" | StorageSource;

export interface ApiKeyResult {
  key: string;
  source: ApiKeySource;
}

export type LoadApiKeyResult =
  | { found: true; key: string; source: StorageSource }
  | { found: false; errors?: { keychain?: string; file?: string } };

export type TeamIdentity = {
  createdAt: string;
  id: string;
  name: string;
};

export type ValidateApiKeyResult =
  | { valid: true; team: TeamIdentity }
  | { valid: false; error: string | undefined };
