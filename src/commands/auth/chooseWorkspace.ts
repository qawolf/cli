import { authMessages } from "~/core/messages/index.js";
import {
  selectWorkspace,
  type SelectWorkspaceResult,
} from "~/domains/auth/selectWorkspace.js";
import { saveTokens } from "~/domains/auth/store/saveTokens.js";
import type { StoredSession } from "~/domains/auth/types.js";
import type { CommandContext } from "~/shell/commandContext.js";
import { createPlatformClient } from "~/shell/platform/createPlatformClient.js";
import type {
  Organization,
  Workspace,
} from "~/shell/platform/organizations.js";

type ChooseWorkspaceArgs = {
  session: StoredSession;
  env: Record<string, string | undefined>;
  fetch: typeof globalThis.fetch;
};

/**
 * Asks the platform which organizations the session reaches, then settles the
 * organization and the workspace. Wiring only — the decision lives in the auth
 * domain.
 */
export async function chooseWorkspace(
  ctx: CommandContext,
  args: ChooseWorkspaceArgs,
): Promise<SelectWorkspaceResult> {
  const client = createPlatformClient(args.session.accessToken, {
    baseUrl: ctx.apiBaseUrl,
    fetch: args.fetch,
    logger: ctx.log("trpc"),
  });

  // Identity lists membership only. The discovery endpoint also applies admin
  // and QA Wolf employee reach, which is the difference between an employee
  // seeing their own workspaces and seeing the client ones they work on. A
  // server that does not serve it leaves the membership list, which is the
  // behaviour before it existed.
  //
  // Asked together: neither depends on the other, and identity is wanted only
  // as the fallback — so a transient identity failure must not abort a
  // selection that discovery could have answered on its own.
  const [identity, discovered] = await Promise.all([
    client.getIdentity(),
    client.getAccessibleOrganizations(),
  ]);

  let organizations;
  if (discovered.ok) {
    organizations = discovered.value;
  } else if (identity.ok) {
    organizations = identity.value.organizations;
  } else {
    return { outcome: "failed", error: identity.error };
  }

  return selectWorkspace({
    organizations,
    preferredOrganization: args.env["QAWOLF_ORGANIZATION"]?.trim(),
    preferredWorkspace: args.env["QAWOLF_WORKSPACE"]?.trim(),

    chooseOrganization: async (organizations: Organization[]) => {
      if (ctx.ui.mode !== "human") return undefined;
      const picked = await ctx.ui.select(
        authMessages.workspace.chooseOrganization,
        organizations.map((organization) => ({
          value: organization.workOsOrganizationId,
          label: organization.name,
          hint: authMessages.workspace.workspaceCount(
            organization.workspaces.length,
          ),
        })),
      );
      if (!picked.ok) return undefined;
      return organizations.find(
        (organization) => organization.workOsOrganizationId === picked.value,
      );
    },

    chooseWorkspace: async (workspaces: Workspace[]) => {
      if (ctx.ui.mode !== "human") return undefined;
      const picked = await ctx.ui.select(
        authMessages.workspace.choose,
        workspaces.map((workspace) => ({
          value: workspace.id,
          label: workspace.name,
          ...(workspace.slug ? { hint: workspace.slug } : {}),
        })),
      );
      if (!picked.ok) return undefined;
      return workspaces.find((workspace) => workspace.id === picked.value);
    },

    // The credential does not move. Routes take the workspace as an argument
    // and authorize it per request, so the session keeps its tokens and only
    // records where the person is working.
    saveWorkspace: (workspaceId) =>
      saveTokens(ctx.configDir, { ...args.session, workspaceId }, ctx.fs),
  });
}

/** Reports the outcome, and says whether the command should fail. */
export function reportWorkspace(
  ctx: CommandContext,
  result: SelectWorkspaceResult,
): { error: string } | undefined {
  switch (result.outcome) {
    case "selected":
      ctx.ui.info(
        authMessages.workspace.working(
          result.organization.name,
          result.workspace.name,
        ),
      );
      return undefined;
    case "none":
      ctx.ui.info(authMessages.workspace.none);
      return undefined;
    case "cancelled":
      // Nothing was cancelled in a non-interactive run: there was no prompt to
      // answer, and the environment did not name enough to settle the choice.
      // Exiting 0 there leaves a script working in the previous workspace.
      if (ctx.ui.mode !== "human") {
        ctx.ui.error(authMessages.workspace.nonInteractive);
        return { error: "workspace not chosen" };
      }
      ctx.ui.info(authMessages.workspace.cancelled);
      return undefined;
    case "failed":
      ctx.ui.warn(result.error);
      return { error: result.error };
  }
}
