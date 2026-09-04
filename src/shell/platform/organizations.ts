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
  return parseOrganizationsResponse(json) ?? [];
}
