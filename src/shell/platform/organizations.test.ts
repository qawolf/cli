import { describe, expect, it } from "bun:test";

import { readOrganizations } from "./organizations.js";

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

describe("readOrganizations", () => {
  it("reads the organizations and the workspaces inside them", () => {
    expect(readOrganizations(grouped)).toEqual([
      {
        id: "qw_org_1",
        name: "Acme Inc",
        workOsOrganizationId: "org_1",
        workspaces: [{ id: "ws_1", name: "Acme", slug: "acme" }],
      },
    ]);
  });

  it("returns none when the server sends neither shape", () => {
    expect(readOrganizations({ user: { email: "a@b.c" } })).toEqual([]);
  });

  it("returns none rather than throwing on a malformed list", () => {
    expect(readOrganizations({ organizations: [{ id: 1 }] })).toEqual([]);
  });

  it("prefers the grouped shape when a server sends both", () => {
    const result = readOrganizations({
      ...grouped,
      workspaces: [
        { id: "ws_x", name: "Stale", slug: "stale", workOsOrganizationId: "z" },
      ],
    });

    expect(result).toEqual([
      {
        id: "qw_org_1",
        name: "Acme Inc",
        workOsOrganizationId: "org_1",
        workspaces: [{ id: "ws_1", name: "Acme", slug: "acme" }],
      },
    ]);
  });
});
