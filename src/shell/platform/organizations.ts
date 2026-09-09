import {
  type IdentityOrganizationsResponse,
  identityOrganizationsResponse,
} from "@qawolf/api-contracts";

/**
 * A user credential reaches every workspace in an organization it belongs to,
 * so the organization is the unit that scopes a session. The shape is the
 * contract's: the identity response and the discovery endpoint share it.
 */
export type Organization =
  IdentityOrganizationsResponse["organizations"][number];

export type Workspace = Organization["workspaces"][number];

/**
 * Strict: a body that does not match yields undefined rather than an empty
 * list, so a caller can tell "serves no organizations" from "does not serve
 * this endpoint".
 */
export function parseOrganizationsResponse(
  json: unknown,
): Organization[] | undefined {
  const parsed = identityOrganizationsResponse.safeParse(json);
  return parsed.success ? parsed.data.organizations : undefined;
}
