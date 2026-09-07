import type {
  Organization,
  Workspace,
} from "~/shell/platform/organizations.js";

/** Case-insensitive, and tolerant of the whitespace an environment variable carries. */
function matches(candidate: string, wanted: string): boolean {
  return candidate.toLowerCase() === wanted.trim().toLowerCase();
}

/**
 * Resolves a value from `QAWOLF_ORGANIZATION` to an organization. Accepts a
 * display name, the QA Wolf id, or the WorkOS id — an organization carries no
 * slug, so there is none to accept.
 */
export function findOrganization(
  organizations: Organization[],
  wanted: string,
): Organization | undefined {
  return organizations.find(
    (organization) =>
      matches(organization.name, wanted) ||
      matches(organization.id, wanted) ||
      matches(organization.workOsOrganizationId, wanted),
  );
}

/**
 * Resolves a value from `QAWOLF_WORKSPACE` to a workspace within one
 * organization. Accepts a display name, a slug, or an id.
 */
export function findWorkspace(
  workspaces: Workspace[],
  wanted: string,
): Workspace | undefined {
  return workspaces.find(
    (workspace) =>
      matches(workspace.name, wanted) ||
      matches(workspace.id, wanted) ||
      (workspace.slug !== undefined && matches(workspace.slug, wanted)),
  );
}

export type WorkspaceMatch =
  | { kind: "found"; organization: Organization; workspace: Workspace }
  | { kind: "none" }
  | { kind: "ambiguous"; organizations: Organization[] };

/**
 * Finds a workspace without being told which organization holds it, so naming
 * one is enough to settle both. Several matches are reported rather than
 * resolved: picking the first would make the choice depend on the order the
 * server happened to list them in.
 */
export function findWorkspaceAcross(
  organizations: Organization[],
  wanted: string,
): WorkspaceMatch {
  const hits = organizations.flatMap((organization) => {
    const workspace = findWorkspace(organization.workspaces, wanted);
    return workspace ? [{ organization, workspace }] : [];
  });

  const [only] = hits;
  if (!only) return { kind: "none" };
  if (hits.length > 1) {
    return {
      kind: "ambiguous",
      organizations: hits.map((h) => h.organization),
    };
  }
  return {
    kind: "found",
    organization: only.organization,
    workspace: only.workspace,
  };
}

export function nameList(
  items: { name: string; slug?: string | undefined }[],
): string {
  return items.map((item) => item.slug ?? item.name).join(", ");
}
