export const authMessages = {
  title: "QA Wolf Authentication",
  promptApiKey: "Paste your QA Wolf API Key",
  verifying: "Verifying API key",
  storing: "Storing API key securely",
  storedKeychain: "Stored in system keychain",
  storedFile: "Stored in local config (system keychain unavailable)",
  outroSuccess: "Authenticated! You're ready to go.",
  alreadyConfigured: "API key configured.",
  outroReady: "Ready.",
  cancelled: "Setup cancelled.",
  notAuthenticated: "Not authenticated",
  whoamiAuthenticated: "Authenticated",
  whoamiFailed: "Not authenticated",
  validationRequired: "API key is required",
  login: {
    nonInteractive:
      "auth login requires an interactive terminal. Set the QAWOLF_API_KEY environment variable for CI authentication.",
    reAuthPrompt: "You are already authenticated. Re-authenticate?",
  },
  logout: {
    title: "Log Out",
    confirmPrompt: "Are you sure you want to log out?",
    notAuthenticated: "Not currently authenticated.",
    envVarWarning:
      "Credentials set via QAWOLF_API_KEY env var cannot be removed by this command. Unset the variable to log out.",
    deleting: "Removing stored credentials",
    credentialsRemoved: "Credentials removed",
    success: "Logged out successfully.",
    cancelled: "Logout cancelled.",
  },
} as const;
