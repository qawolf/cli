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
 * The choice is local. Public API routes take the workspace as an argument and
 * authorize it per request, so working in a workspace needs no change to the
 * credential — which is what lets a QA Wolf employee reach a client workspace
 * their token's organization does not contain, and what stops an ordinary
 * workspace change from depending on the identity provider at all.
 *
 * The organization groups the prompt; it is not a scope that gets stored.
 */
export async function selectWorkspace(
  deps: SelectWorkspaceDeps,
): Promise<SelectWorkspaceResult> {
  const { organizations } = deps;
  if (organizations.length === 0) return { outcome: "none" };

  let organization: Organization | undefined;
  if (deps.preferredOrganization) {
    organization = findOrganization(organizations, deps.preferredOrganization);
    if (!organization) {
      return {
        outcome: "failed",
        error: `No organization matches '${deps.preferredOrganization}'. Available: ${nameList(organizations)}.`,
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
        error: `No workspace matches '${deps.preferredWorkspace}'. Available: ${nameList(organizations.flatMap((o) => o.workspaces))}.`,
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
        error: `No workspace matches '${deps.preferredWorkspace}' in ${organization.name}. Available: ${nameList(workspaces)}.`,
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

  await deps.saveWorkspace(workspace.id);
  return { outcome: "selected", organization, workspace };
}
