export const authCopy = {
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
  whoamiAuthenticated: "Authenticated",
  validationRequired: "API key is required",
  validationFailed: "API key is invalid. Check your key and try again.",
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
    success: "Logged out successfully.",
    cancelled: "Logout cancelled.",
  },
  ci: {
    errorTitle: "QA Wolf API key not found.",
    errorBody: [
      "Set the QAWOLF_API_KEY environment variable to authenticate.",
      "",
      "Example:",
      "  export QAWOLF_API_KEY=qaw_your_api_key",
      "",
      "Get your API key at https://app.qawolf.com/settings/integrations",
    ].join("\n"),
  },
} as const;
