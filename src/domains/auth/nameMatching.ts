import type {
  Organization,
  Workspace,
} from "~/shell/platform/organizations.js";

/**
 * Resolves a name someone typed — through a flag or the environment — to an
 * organization or a workspace. Matching is case-insensitive and accepts any
 * identifier the person is likely to have to hand: a slug, a display name, or
 * an id.
 */
function matches(candidate: string, wanted: string): boolean {
  return candidate.toLowerCase() === wanted.trim().toLowerCase();
}

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

export function nameList(
  items: { name: string; slug?: string | undefined }[],
): string {
  return items.map((item) => item.slug ?? item.name).join(", ");
}
