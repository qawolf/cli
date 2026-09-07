import { describe, expect, it } from "bun:test";

import { parseOrganizationsResponse } from "./organizations.js";

const grouped = {
  organizations: [
    {
      id: "qw_org_1",
      name: "Acme Inc",
      workOsOrganizationId: "org_1",
      workspaces: [{ id: "ws_1", name: "Acme", slug: "acme" }],
    },
  ],
};

describe("parseOrganizationsResponse", () => {
  it("reads the organizations and the workspaces inside them", () => {
    expect(parseOrganizationsResponse(grouped)).toEqual(grouped.organizations);
  });

  // Undefined rather than an empty list: a caller must be able to tell a
  // deployment that serves no organizations from one that does not serve the
  // endpoint at all.
  it("returns undefined when the body is not the contract", () => {
    expect(
      parseOrganizationsResponse({ user: { email: "a@b.c" } }),
    ).toBeUndefined();
    expect(
      parseOrganizationsResponse({ organizations: [{ id: 1 }] }),
    ).toBeUndefined();
  });
});
