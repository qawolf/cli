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
    chooseMethod: "How do you want to sign in?",
    methodBrowser: "Browser",
    methodBrowserHint: "Sign in with your QA Wolf account",
    methodApiKey: "API key",
    methodApiKeyHint: "Paste a team key — needed for flows pull and flows run",
    // An API key deliberately outranks a browser session, because it carries
    // team scope a user token does not. Said out loud here because the sign-in
    // that follows reports success, and without this the person is left
    // believing they changed which identity their commands use.
    apiKeyPrecedence: {
      env: "QAWOLF_API_KEY is set, and an API key takes precedence over a browser session. Commands continue to use that key until you unset the variable.",
      stored:
        "A stored API key takes precedence over a browser session. Commands continue to use that key until you run 'qawolf auth logout' and sign in again.",
    },
  },
  device: {
    unavailable:
      "This QA Wolf deployment does not offer browser sign-in. Run 'qawolf auth login' again and choose 'API key'.",
    configUnreachable:
      "Could not ask this QA Wolf deployment whether it offers browser sign-in. Check your connection, then try again.",
    confirmCode: (userCode: string) => `Your code is ${userCode}`,
    visitUrl: (url: string) => `Confirm it at ${url}`,
    // RFC 8628 asks a client using the prefilled URL to show the plain one too,
    // for anyone who cannot follow the shortcut — a wrapped or truncated long
    // URL in a narrow terminal being exactly that case.
    visitUrlPlain: (url: string) => `Or go to ${url} and enter the code`,
    openFailed: (url: string) =>
      `Could not open a browser automatically. Open ${url} yourself to continue.`,
    waiting: "Waiting for you to finish in the browser",
    signedIn: (email: string) => `Signed in as ${email}.`,
    failed: {
      "access-denied": "The sign-in request was rejected.",
      expired: "The sign-in request expired. Run 'qawolf auth login' to retry.",
      timeout:
        "The sign-in request timed out. Run 'qawolf auth login' to retry.",
      network: "Could not reach WorkOS to complete sign-in.",
      unavailable: "Could not start browser sign-in.",
      cancelled: "Sign-in cancelled.",
    },
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
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
  },
} as const;
