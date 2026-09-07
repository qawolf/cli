import { mock } from "bun:test";

import type {
  Organization,
  Workspace,
} from "~/shell/platform/organizations.js";

export const acmeMain: Workspace = {
  id: "ws_main",
  name: "Main",
  slug: "main",
};
export const acmeStaging: Workspace = {
  id: "ws_stg",
  name: "Staging",
  slug: "stg",
};

export const acme: Organization = {
  id: "qw_acme",
  name: "Acme",
  workOsOrganizationId: "org_acme",
  workspaces: [acmeMain, acmeStaging],
};

export const solo: Workspace = { id: "ws_solo", name: "Solo", slug: "solo" };

export const personal: Organization = {
  id: "qw_personal",
  name: "Chase J",
  workOsOrganizationId: "org_personal",
  workspaces: [solo],
};

export function makeDeps(
  overrides: {
    organizations?: Organization[];
    grantedOrganizationId?: string | undefined;
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
      grantedOrganizationId: overrides.grantedOrganizationId,
      preferredOrganization: overrides.preferredOrganization,
      preferredWorkspace: overrides.preferredWorkspace,
      chooseOrganization,
      chooseWorkspace,
      saveWorkspace,
    },
  };
}
