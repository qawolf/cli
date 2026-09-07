import { authMessages } from "~/core/messages/index.js";
import type { Organization } from "~/shell/platform/organizations.js";

/**
 * What `whoami` says about the saved workspace. The chosen workspace is what
 * every public API command sends, so the one command whose job is to report
 * the session has to name it. A saved id the token cannot use is worth naming
 * too: nothing else surfaces it, and every later request would fail on it.
 *
 * Only the organization the token was granted for can hold the active
 * workspace; a saved id under any other listed organization is out of reach
 * however the list reads.
 */
export function describeActiveWorkspace(
  workspaceId: string | undefined,
  grantedOrganizationId: string,
  organizations: readonly Organization[],
): string | undefined {
  if (!workspaceId) return undefined;

  const found = organizations
    .filter((candidate) => candidate.id === grantedOrganizationId)
    .flatMap((candidate) =>
      candidate.workspaces.map((workspace) => ({
        organization: candidate.name,
        workspace: workspace.name,
        id: workspace.id,
      })),
    )
    .find((entry) => entry.id === workspaceId);

  return authMessages.whoami.activeWorkspace(workspaceId, found);
}
