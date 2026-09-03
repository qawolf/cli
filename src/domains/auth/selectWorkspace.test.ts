import { describe, expect, it, mock } from "bun:test";

import type {
  Organization,
  Workspace,
} from "~/shell/platform/organizations.js";
import { selectWorkspace } from "./selectWorkspace.js";

const acmeMain: Workspace = { id: "ws_main", name: "Main", slug: "main" };
const acmeStaging: Workspace = { id: "ws_stg", name: "Staging", slug: "stg" };

const acme: Organization = {
  id: "qw_acme",
  name: "Acme",
  workOsOrganizationId: "org_acme",
  workspaces: [acmeMain, acmeStaging],
};

const solo: Workspace = { id: "ws_solo", name: "Solo", slug: "solo" };

const personal: Organization = {
  id: "qw_personal",
  name: "Chase J",
  workOsOrganizationId: "org_personal",
  workspaces: [solo],
};

function makeDeps(
  overrides: {
    organizations?: Organization[];
    preferredOrganization?: string | undefined;
    preferredWorkspace?: string | undefined;
    chosenOrganization?: Organization | undefined;
    chosenWorkspace?: Workspace | undefined;
  } = {},
) {
  const chooseOrganization = mock(async (_organizations: Organization[]) =>
    "chosenOrganization" in overrides ? overrides.chosenOrganization : acme,
  );
  const chooseWorkspace = mock(async (_workspaces: Workspace[]) =>
    "chosenWorkspace" in overrides ? overrides.chosenWorkspace : acmeMain,
  );
  const saveWorkspace = mock(async (_workspaceId: string) => {});

  return {
    chooseOrganization,
    chooseWorkspace,
    saveWorkspace,
    deps: {
      organizations: overrides.organizations ?? [acme, personal],
      preferredOrganization: overrides.preferredOrganization,
      preferredWorkspace: overrides.preferredWorkspace,
      chooseOrganization,
      chooseWorkspace,
      saveWorkspace,
    },
  };
}

describe("selectWorkspace", () => {
  it("does nothing when the account reaches no organizations", async () => {
    const { deps, chooseOrganization } = makeDeps({ organizations: [] });

    expect(await selectWorkspace(deps)).toEqual({ outcome: "none" });
    expect(chooseOrganization).not.toHaveBeenCalled();
  });

  it("asks for the organization first, then the workspace inside it", async () => {
    const { deps, chooseOrganization, chooseWorkspace } = makeDeps();

    const result = await selectWorkspace(deps);

    expect(chooseOrganization).toHaveBeenCalledWith([acme, personal]);
    expect(chooseWorkspace).toHaveBeenCalledWith([acmeMain, acmeStaging]);
    expect(result).toEqual({
      outcome: "selected",
      organization: acme,
      workspace: acmeMain,
    });
  });

  it("stores only the workspace, because that is what a request carries", async () => {
    const { deps, saveWorkspace } = makeDeps();

    await selectWorkspace(deps);

    expect(saveWorkspace).toHaveBeenCalledWith("ws_main");
  });

  it("reaches an organization the person is no longer a member of", async () => {
    // Employee reach: the API authorizes by workspace, so choosing one outside
    // the credential's organization needs no token change and cannot be
    // refused by the identity provider.
    const { deps, saveWorkspace } = makeDeps({
      organizations: [acme],
      chosenWorkspace: acmeStaging,
    });

    const result = await selectWorkspace(deps);

    expect(result).toEqual({
      outcome: "selected",
      organization: acme,
      workspace: acmeStaging,
    });
    expect(saveWorkspace).toHaveBeenCalledWith("ws_stg");
  });

  it("does not ask for an organization when there is only one", async () => {
    const { deps, chooseOrganization, chooseWorkspace } = makeDeps({
      organizations: [acme],
    });

    await selectWorkspace(deps);

    expect(chooseOrganization).not.toHaveBeenCalled();
    expect(chooseWorkspace).toHaveBeenCalledWith([acmeMain, acmeStaging]);
  });

  it("does not ask for a workspace when the organization has only one", async () => {
    const { deps, chooseWorkspace } = makeDeps({ organizations: [personal] });

    const result = await selectWorkspace(deps);

    expect(chooseWorkspace).not.toHaveBeenCalled();
    expect(result).toEqual({
      outcome: "selected",
      organization: personal,
      workspace: solo,
    });
  });

  it("takes a named organization and workspace without asking", async () => {
    const { deps, chooseOrganization, chooseWorkspace } = makeDeps({
      preferredOrganization: "Acme",
      preferredWorkspace: "stg",
    });

    const result = await selectWorkspace(deps);

    expect(chooseOrganization).not.toHaveBeenCalled();
    expect(chooseWorkspace).not.toHaveBeenCalled();
    expect(result).toEqual({
      outcome: "selected",
      organization: acme,
      workspace: acmeStaging,
    });
  });

  it("fails with the available organizations when the named one is unknown", async () => {
    const { deps } = makeDeps({ preferredOrganization: "nope" });

    const result = await selectWorkspace(deps);

    if (result.outcome !== "failed") throw Error("expected failure");
    expect(result.error).toContain("nope");
    expect(result.error).toContain("Acme");
  });

  it("fails with the available workspaces when the named one is unknown", async () => {
    const { deps } = makeDeps({
      preferredOrganization: "Acme",
      preferredWorkspace: "nope",
    });

    const result = await selectWorkspace(deps);

    if (result.outcome !== "failed") throw Error("expected failure");
    expect(result.error).toContain("main");
  });

  it("stops without storing when either choice is dismissed", async () => {
    const orgCancelled = makeDeps({ chosenOrganization: undefined });
    expect(await selectWorkspace(orgCancelled.deps)).toEqual({
      outcome: "cancelled",
    });
    expect(orgCancelled.saveWorkspace).not.toHaveBeenCalled();

    const workspaceCancelled = makeDeps({ chosenWorkspace: undefined });
    expect(await selectWorkspace(workspaceCancelled.deps)).toEqual({
      outcome: "cancelled",
    });
    expect(workspaceCancelled.saveWorkspace).not.toHaveBeenCalled();
  });
});
