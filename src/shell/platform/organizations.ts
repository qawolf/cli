import { z } from "zod";

export type Workspace = {
  id: string;
  name: string;
  slug: string | undefined;
};

/**
 * A user credential reaches every workspace in an organization it belongs to,
 * so the organization is the unit that scopes a session.
 */
export type Organization = {
  id: string;
  name: string;
  workOsOrganizationId: string;
  workspaces: Workspace[];
};

const workspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
});

const groupedEnvelope = z.object({
  organizations: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      workOsOrganizationId: z.string().min(1),
      workspaces: z.array(workspaceSchema),
    }),
  ),
});

const flatEnvelope = z.object({
  workspaces: z.array(
    workspaceSchema.extend({ workOsOrganizationId: z.string().min(1) }),
  ),
});

/**
 * Only for servers that predate the grouped response, whose entries name no
 * organization — so each group is labelled with its WorkOS id, the one
 * identifier present. Delete once every environment serves `organizations`.
 */
function groupFlatWorkspaces(
  entries: z.infer<typeof flatEnvelope>["workspaces"],
): Organization[] {
  const byOrganization = new Map<string, Organization>();
  for (const entry of entries) {
    const existing = byOrganization.get(entry.workOsOrganizationId);
    const workspace: Workspace = {
      id: entry.id,
      name: entry.name,
      slug: entry.slug,
    };
    if (existing) {
      existing.workspaces.push(workspace);
      continue;
    }
    byOrganization.set(entry.workOsOrganizationId, {
      id: entry.workOsOrganizationId,
      name: entry.workOsOrganizationId,
      workOsOrganizationId: entry.workOsOrganizationId,
      workspaces: [workspace],
    });
  }
  return [...byOrganization.values()];
}

/**
 * Strict, unlike {@link readOrganizations}: a body that does not match yields
 * undefined rather than an empty list, so a caller can tell "serves no
 * organizations" from "does not serve this endpoint".
 */
export function parseOrganizationsResponse(
  json: unknown,
): Organization[] | undefined {
  const parsed = groupedEnvelope.safeParse(json);
  if (!parsed.success) return undefined;
  return parsed.data.organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    workOsOrganizationId: organization.workOsOrganizationId,
    workspaces: organization.workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    })),
  }));
}

/**
 * Pulls the organizations out of an identity response.
 *
 * Read alongside the published identity contract rather than through it, so a
 * server that does not send them yet degrades to none instead of failing the
 * whole response.
 */
export function readOrganizations(json: unknown): Organization[] {
  const grouped = groupedEnvelope.safeParse(json);
  if (grouped.success) {
    return grouped.data.organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      workOsOrganizationId: organization.workOsOrganizationId,
      workspaces: organization.workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
      })),
    }));
  }

  const flat = flatEnvelope.safeParse(json);
  if (flat.success) return groupFlatWorkspaces(flat.data.workspaces);

  return [];
}
