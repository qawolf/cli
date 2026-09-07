export const service = "qawolf-cli";
export const account = "api-key";
export const credentialsFile = "credentials.json";

// A separate entry, not new fields on the api-key record: moving that record to
// a JSON payload would strand every key already in a keychain.
export const tokensAccount = "oauth-tokens";
export const tokensFile = "tokens.json";
