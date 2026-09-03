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

  describe("older servers that send a flat workspace list", () => {
    // Kept only until every environment serves the grouped shape. The flat
    // entries name no organization, so each becomes a group labelled by the
    // only identifier available.
    const flat = {
      workspaces: [
        {
          id: "ws_1",
          name: "Acme",
          slug: "acme",
          workOsOrganizationId: "org_1",
        },
        {
          id: "ws_2",
          name: "Side",
          slug: "side",
          workOsOrganizationId: "org_1",
        },
        {
          id: "ws_3",
          name: "Solo",
          slug: "solo",
          workOsOrganizationId: "org_2",
        },
      ],
    };

    it("groups a flat list by its organization", () => {
      const result = readOrganizations(flat);

      expect(result).toHaveLength(2);
      expect(result[0]?.workOsOrganizationId).toBe("org_1");
      expect(result[0]?.workspaces.map((w) => w.name)).toEqual([
        "Acme",
        "Side",
      ]);
      expect(result[1]?.workspaces.map((w) => w.name)).toEqual(["Solo"]);
    });

    it("labels each group with the only name it has", () => {
      expect(readOrganizations(flat)[0]?.name).toBe("org_1");
    });
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
