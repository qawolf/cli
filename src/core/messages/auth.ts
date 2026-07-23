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
  errors: {
    identity: {
      invalidOrUnauthorized: "API key is invalid or unauthorized",
      unexpectedFormat: "Could not verify API key: unexpected response format",
      couldNotVerify: (detail: string, status: number) =>
        `Could not verify API key: ${detail || `HTTP ${status}`}`,
      couldNotVerifyNetwork: (cause: string) =>
        `Could not verify API key: ${cause}`,
    },
    request: {
      rejected401: (noun: string | undefined) =>
        `QA Wolf API rejected the${noun ? ` ${noun}` : ""} request (HTTP 401). Check your API key.`,
      rejected403: (noun: string | undefined) =>
        `QA Wolf API rejected the${noun ? ` ${noun}` : ""} request (HTTP 403). Check that your API key has access to this environment.`,
      notFound404: (noun: string | undefined) =>
        `QA Wolf API could not find ${noun ? `${noun} for that environment` : "that environment"} (HTTP 404). Check the --env value.`,
      failedWithStatus: (status: number, noun: string | undefined) =>
        `QA Wolf API${noun ? ` ${noun}` : ""} request failed (HTTP ${status}).`,
      networkUnreachable: (baseUrl: string, noun: string | undefined) =>
        `Could not reach the QA Wolf API at ${baseUrl}${noun ? ` to fetch ${noun}` : ""}. Check your network connection and QAWOLF_HOST_URL.`,
      unexpectedResponse: (noun: string | undefined) =>
        `Unexpected${noun ? ` ${noun}` : ""} response from the QA Wolf API.`,
    },
    bundle: {
      linkExpired:
        "The flow bundle download link has expired. Please run `qawolf flows pull` again to refresh.",
      failedWithStatus: (status: number) =>
        `Could not download the flow bundle (HTTP ${status}).`,
      networkUnreachable:
        "Could not reach the flow bundle storage. Check your network connection and try again.",
      malformed:
        "The flow bundle download was malformed. Please run `qawolf flows pull` again.",
    },
  },
  whoami: {
    source: (source: string) => `Source: ${source}`,
    authFailed: (source: string, error: string) =>
      `Authentication failed (source: ${source}): ${error}`,
    authenticatedAs: (teamName: string, source: string) =>
      `Authenticated as ${teamName} (source: ${source})`,
    teamNote: (input: {
      team: { id: string; name: string; slug?: string | undefined };
      teamUrl: string | undefined;
      source: string;
    }) =>
      [
        `Team:   ${input.team.name}`,
        `ID:     ${input.team.id}`,
        input.team.slug ? `Slug:   ${input.team.slug}` : undefined,
        input.teamUrl ? `URL:    ${input.teamUrl}` : undefined,
        `Source: ${input.source}`,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
  },
} as const;
