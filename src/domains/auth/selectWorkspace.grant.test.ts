import { describe, expect, it } from "bun:test";

import { selectWorkspace } from "./selectWorkspace.js";
import {
  acme,
  acmeMain,
  acmeStaging,
  makeDeps,
  personal,
} from "./selectWorkspace.testUtils.js";

// A Connect token is consented to one organization, and the API confines the
// session to it — for QA Wolf employees and administrators too. Offering
// anything else would let a person pick a workspace every later request is
// refused for.
describe("selectWorkspace within the granted organization", () => {
  it("offers only the organization the token was granted for", async () => {
    const { deps, chooseOrganization, chooseWorkspace } = makeDeps({
      grantedOrganizationId: "org_acme",
    });

    const result = await selectWorkspace(deps);

    expect(chooseOrganization).not.toHaveBeenCalled();
    expect(chooseWorkspace).toHaveBeenCalledWith([acmeMain, acmeStaging]);
    expect(result).toEqual({
      outcome: "selected",
      organization: acme,
      workspace: acmeMain,
    });
  });

  it("refuses QAWOLF_ORGANIZATION naming an organization outside the grant", async () => {
    const { deps, saveWorkspace } = makeDeps({
      grantedOrganizationId: "org_acme",
      preferredOrganization: "Chase J",
    });

    const result = await selectWorkspace(deps);

    if (result.outcome !== "failed") throw Error("expected a failure");
    expect(result.error).toContain("Chase J");
    expect(result.error).toContain("qawolf auth login");
    expect(saveWorkspace).not.toHaveBeenCalled();
  });

  it("refuses QAWOLF_WORKSPACE naming a workspace outside the grant", async () => {
    const { deps, saveWorkspace } = makeDeps({
      grantedOrganizationId: "org_acme",
      preferredWorkspace: "solo",
      chosenOrganization: undefined,
      chosenWorkspace: undefined,
    });

    const result = await selectWorkspace(deps);

    if (result.outcome !== "failed") throw Error("expected a failure");
    expect(result.error).toContain("solo");
    expect(result.error).toContain("qawolf auth login");
    expect(saveWorkspace).not.toHaveBeenCalled();
  });

  // A server may still list wider reach than the token allows. The CLI cannot
  // act on it: the token's organization is fixed at sign-in.
  it("fails rather than offering organizations the grant does not cover", async () => {
    const { deps, chooseOrganization, chooseWorkspace } = makeDeps({
      organizations: [personal],
      grantedOrganizationId: "org_acme",
    });

    const result = await selectWorkspace(deps);

    if (result.outcome !== "failed") throw Error("expected a failure");
    expect(result.error).toContain("qawolf auth login");
    expect(chooseOrganization).not.toHaveBeenCalled();
    expect(chooseWorkspace).not.toHaveBeenCalled();
  });

  it("still reports none when the API lists no organizations at all", async () => {
    const { deps } = makeDeps({
      organizations: [],
      grantedOrganizationId: "org_acme",
    });

    expect(await selectWorkspace(deps)).toEqual({ outcome: "none" });
  });
});
