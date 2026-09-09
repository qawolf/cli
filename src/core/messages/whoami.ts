/**
 * What `qawolf auth whoami` prints. Split from the rest of the auth copy because
 * it is the only part that renders a whole identity rather than a single line.
 */
export const whoamiMessages = {
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
      `Workspace: ${input.team.name}`,
      `ID:        ${input.team.id}`,
      input.team.slug ? `Slug:      ${input.team.slug}` : undefined,
      input.teamUrl ? `URL:       ${input.teamUrl}` : undefined,
      `Source:    ${input.source}`,
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
              (o) => `${o.name}: ${o.workspaces.map((w) => w.name).join(", ")}`,
            )
            .join(" | ")}`
        : undefined,
      `Source:       ${input.source}`,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n"),
} as const;
