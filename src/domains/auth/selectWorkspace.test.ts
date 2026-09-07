import { describe, expect, it } from "bun:test";

import type { Organization } from "~/shell/platform/organizations.js";
import { selectWorkspace } from "./selectWorkspace.js";
import {
  acme,
  acmeMain,
  acmeStaging,
  makeDeps,
  personal,
  solo,
} from "./selectWorkspace.testUtils.js";

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

  it("uses the only organization it is given without asking", async () => {
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
  // The defect this covers: preferredWorkspace was only consulted after the
  // organization had been settled, so naming a workspace alone fell through to
  // an organization prompt — which a non-interactive run answers with
  // `undefined`, giving "cancelled" and exit 0 with nothing changed.
  it("lets a named workspace settle the organization too", async () => {
    const { deps, chooseOrganization, saveWorkspace } = makeDeps({
      preferredWorkspace: "stg",
      chosenOrganization: undefined,
      chosenWorkspace: undefined,
    });

    const result = await selectWorkspace(deps);

    expect(result).toEqual({
      outcome: "selected",
      organization: acme,
      workspace: acmeStaging,
    });
    expect(chooseOrganization).not.toHaveBeenCalled();
    expect(saveWorkspace).toHaveBeenCalledWith("ws_stg");
  });

  it("names the organizations when a workspace matches in more than one", async () => {
    const twin: Organization = {
      id: "qw_twin",
      name: "Twin",
      workOsOrganizationId: "org_twin",
      workspaces: [{ id: "ws_other_main", name: "Main", slug: "main" }],
    };
    const { deps } = makeDeps({
      organizations: [acme, twin],
      preferredWorkspace: "main",
      chosenOrganization: undefined,
      chosenWorkspace: undefined,
    });

    const result = await selectWorkspace(deps);

    if (result.outcome !== "failed") throw Error("expected a failure");
    expect(result.error).toContain("More than one organization");
    expect(result.error).toContain("QAWOLF_ORGANIZATION");
  });

  it("reports a named workspace that exists in no organization", async () => {
    const { deps } = makeDeps({
      preferredWorkspace: "nope",
      chosenOrganization: undefined,
      chosenWorkspace: undefined,
    });

    const result = await selectWorkspace(deps);

    if (result.outcome !== "failed") throw Error("expected a failure");
    expect(result.error).toContain("No workspace matches 'nope'");
  });

  // Every other way out is a typed outcome the command renders. A write that
  // fails must be one too, not an exception after the credential was stored.
  it("reports a failed save as a failure rather than throwing", async () => {
    const { deps } = makeDeps({ organizations: [personal] });
    const failing = {
      ...deps,
      saveWorkspace: async () => {
        throw Error("EACCES: permission denied");
      },
    };

    const result = await selectWorkspace(failing);

    if (result.outcome !== "failed") throw Error("expected a failure");
    expect(result.error).toContain("Could not save");
    expect(result.error).toContain("EACCES");
  });
});
