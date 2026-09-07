import { errorMessage } from "~/core/errors.js";
import { authMessages } from "~/core/messages/index.js";
import type {
  Organization,
  Workspace,
} from "~/shell/platform/organizations.js";
import {
  findOrganization,
  findWorkspace,
  findWorkspaceAcross,
  nameList,
} from "./nameMatching.js";

export type SelectWorkspaceDeps = {
  organizations: Organization[];
  /**
   * The WorkOS organization the token was granted for. The API confines the
   * session to it, so nothing outside it is offered, whatever the API lists.
   * Undefined for a token that names none, which is left to the API to refuse.
   */
  grantedOrganizationId: string | undefined;
  /** An organization named through the environment, which skips its prompt. */
  preferredOrganization: string | undefined;
  /** A workspace named through the environment, which skips its prompt. */
  preferredWorkspace: string | undefined;
  chooseOrganization: (
    organizations: Organization[],
  ) => Promise<Organization | undefined>;
  chooseWorkspace: (workspaces: Workspace[]) => Promise<Workspace | undefined>;
  saveWorkspace: (workspaceId: string) => Promise<unknown>;
};

export type SelectWorkspaceResult =
  | { outcome: "selected"; organization: Organization; workspace: Workspace }
  | { outcome: "none" }
  | { outcome: "cancelled" }
  | { outcome: "failed"; error: string };

/**
 * Settles which workspace a session works in, asking for the organization first
 * when there is more than one.
 *
 * The choice is local within the granted organization. Public API routes take
 * the workspace as an argument and authorize it per request, so moving between
 * workspaces of that organization needs no change to the credential. Moving to
 * another organization does: a Connect token is consented to one, and changing
 * a stored id cannot change the token's `org_id`. Anything outside the grant is
 * therefore refused here with a pointer to signing in again, never offered.
 */
export async function selectWorkspace(
  deps: SelectWorkspaceDeps,
): Promise<SelectWorkspaceResult> {
  if (deps.organizations.length === 0) return { outcome: "none" };

  const granted = deps.grantedOrganizationId;
  const organizations = granted
    ? deps.organizations.filter((o) => o.workOsOrganizationId === granted)
    : deps.organizations;
  if (organizations.length === 0) {
    return { outcome: "failed", error: authMessages.workspace.noneInGrant };
  }
  // Appended to every "not found" below: the thing named may well exist, in an
  // organization this sign-in cannot reach.
  const hint = granted ? ` ${authMessages.workspace.signInElsewhere}` : "";

  let organization: Organization | undefined;
  if (deps.preferredOrganization) {
    organization = findOrganization(organizations, deps.preferredOrganization);
    if (!organization) {
      return {
        outcome: "failed",
        error: `No organization matches '${deps.preferredOrganization}'. Available: ${nameList(organizations)}.${hint}`,
      };
    }
  } else if (organizations.length === 1) {
    organization = organizations[0];
  } else if (deps.preferredWorkspace) {
    // A named workspace settles the organization too. Without this the
    // organization prompt runs first, so naming only a workspace could never
    // choose anything unattended — the run fell through to a prompt that
    // cannot be answered.
    const match = findWorkspaceAcross(organizations, deps.preferredWorkspace);
    if (match.kind === "none") {
      return {
        outcome: "failed",
        error: `No workspace matches '${deps.preferredWorkspace}'. Available: ${nameList(organizations.flatMap((o) => o.workspaces))}.${hint}`,
      };
    }
    if (match.kind === "ambiguous") {
      return {
        outcome: "failed",
        error: `More than one organization has a workspace matching '${deps.preferredWorkspace}': ${nameList(match.organizations)}. Set QAWOLF_ORGANIZATION to choose between them.`,
      };
    }
    organization = match.organization;
  } else {
    organization = await deps.chooseOrganization(organizations);
    if (!organization) return { outcome: "cancelled" };
  }

  // Unreachable: every branch above either assigns or returns. It exists only
  // because noUncheckedIndexedAccess widens organizations[0]. Reporting "none"
  // here would claim the account reaches no organizations while holding one.
  if (!organization) throw Error("organization was not settled");

  const { workspaces } = organization;
  if (workspaces.length === 0) {
    return {
      outcome: "failed",
      error: `Organization '${organization.name}' has no workspaces.`,
    };
  }

  let workspace: Workspace | undefined;
  if (deps.preferredWorkspace) {
    workspace = findWorkspace(workspaces, deps.preferredWorkspace);
    if (!workspace) {
      return {
        outcome: "failed",
        error: `No workspace matches '${deps.preferredWorkspace}' in ${organization.name}. Available: ${nameList(workspaces)}.${hint}`,
      };
    }
  } else if (workspaces.length === 1) {
    workspace = workspaces[0];
  } else {
    workspace = await deps.chooseWorkspace(workspaces);
    if (!workspace) return { outcome: "cancelled" };
  }

  // Unreachable, for the same reason as the organization guard above.
  if (!workspace) throw Error("workspace was not settled");

  // Storage is I/O and can refuse. Every other way out of here is a typed
  // outcome the command layer renders, so a failed write is one too rather
  // than an exception that escapes after the credential was already stored.
  try {
    await deps.saveWorkspace(workspace.id);
  } catch (err: unknown) {
    return {
      outcome: "failed",
      error: authMessages.workspace.saveFailed(errorMessage(err)),
    };
  }
  return { outcome: "selected", organization, workspace };
}
