import { authErrorMessages } from "./authErrors.js";

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
  errors: authErrorMessages,
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
    organizationNote: (input: {
      organization: { id: string; name: string };
      source: string;
    }) =>
      [
        `Organization: ${input.organization.name}`,
        `ID:           ${input.organization.id}`,
        `Source:       ${input.source}`,
      ].join("\n"),
    userNote: (input: {
      user: { email: string; id: string };
      organization: { id: string; name: string };
      source: string;
    }) =>
      [
        `User:         ${input.user.email}`,
        `ID:           ${input.user.id}`,
        `Organization: ${input.organization.name}`,
        `Source:       ${input.source}`,
      ].join("\n"),
  },
} as const;
