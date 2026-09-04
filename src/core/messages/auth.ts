import { deviceMessages } from "./authDevice.js";
import { pluralize } from "~/core/pluralize.js";
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
  device: deviceMessages,
  workspace: {
    chooseOrganization: "Which organization do you want to work in?",
    choose: "Which workspace do you want to use?",
    workspaceCount: (count: number) => pluralize(count, "workspace"),
    working: (organization: string, workspace: string) =>
      `Working in ${workspace} (${organization}).`,
    none: "This account reaches no organizations yet.",
    cancelled: "Workspace not changed.",
    notSignedIn:
      "Workspace switching needs a browser sign-in. Run 'qawolf auth login' and choose Browser.",
    sessionExpired:
      "Your session could not be renewed. Run 'qawolf auth login' to sign in again.",
    nonInteractive:
      "auth switch needs an interactive terminal, or set QAWOLF_WORKSPACE to name a workspace.",
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
    /** The workspace the next command will use, named for a person to check. */
    activeWorkspace: (
      workspaceId: string,
      found: { organization: string; workspace: string } | undefined,
    ) =>
      found
        ? `${found.workspace} (${found.organization})`
        : `${workspaceId} — no longer in reach; run 'qawolf auth switch'`,
    userNote: (input: {
      user: { email: string; id: string };
      organization: { id: string; name: string };
      source: string;
      activeWorkspace: string | undefined;
      organizations: readonly {
        name: string;
        workspaces: readonly { name: string }[];
      }[];
    }) =>
      [
        `User:         ${input.user.email}`,
        `ID:           ${input.user.id}`,
        `Organization: ${input.organization.name}`,
        input.activeWorkspace
          ? `Workspace:    ${input.activeWorkspace}`
          : undefined,
        input.organizations.length > 0
          ? `Workspaces:   ${input.organizations
              .map(
                (o) =>
                  `${o.name}: ${o.workspaces.map((w) => w.name).join(", ")}`,
              )
              .join(" | ")}`
          : undefined,
        `Source:       ${input.source}`,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
  },
} as const;
