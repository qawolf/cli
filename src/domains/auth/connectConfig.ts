import { apiResource } from "~/core/deviceAuth/resource.js";
import { getAuthConfig } from "~/shell/platform/getAuthConfig.js";
import { discoverIssuer } from "~/shell/workos/discoverIssuer.js";
import type { IssuerEndpoints } from "~/shell/workos/types.js";

/** Everything a Connect sign-in against one deployment needs. */
export type ConnectConfig = {
  issuer: string;
  clientId: string;
  /** The deployment's API resource, derived from the url the CLI is aimed at. */
  resource: string;
  endpoints: IssuerEndpoints;
};

export type ConnectConfigResult =
  | { kind: "configured"; config: ConnectConfig }
  /** The deployment answered, and offers no browser sign-in. */
  | { kind: "unavailable" }
  /** The deployment offers only the pre-Connect flow, whose tokens the API refuses. */
  | { kind: "legacy-only" }
  /** The deployment publishes half a Connect configuration. */
  | { kind: "misconfigured"; detail: string }
  /** The deployment or the issuer could not be asked; worth trying again. */
  | { kind: "unreachable"; detail: string }
  /** The issuer answered with metadata the CLI will not sign in against. */
  | { kind: "discovery-failed"; detail: string };

type Deps = {
  fetch: typeof globalThis.fetch;
  apiBaseUrl: string;
};

/**
 * Two discoveries in sequence: the deployment names its issuer and public
 * client, then the issuer names its endpoints. The deployment is asked first
 * and the issuer only when there is one, so a deployment without Connect
 * costs one request and no contact with WorkOS.
 */
export async function resolveConnectConfig(
  deps: Deps,
): Promise<ConnectConfigResult> {
  const authConfig = await getAuthConfig({
    baseUrl: deps.apiBaseUrl,
    fetch: deps.fetch,
  });

  switch (authConfig.kind) {
    case "unreachable":
      return { kind: "unreachable", detail: authConfig.detail };
    case "unconfigured":
      return { kind: "unavailable" };
    case "legacy-only":
      return { kind: "legacy-only" };
    case "misconfigured":
      return { kind: "misconfigured", detail: authConfig.detail };
    case "configured":
      break;
  }

  const endpoints = await discoverIssuer(authConfig.issuer, deps.fetch);
  if (!endpoints.ok) {
    return endpoints.retryable
      ? { kind: "unreachable", detail: endpoints.error }
      : { kind: "discovery-failed", detail: endpoints.error };
  }

  return {
    kind: "configured",
    config: {
      issuer: authConfig.issuer,
      clientId: authConfig.clientId,
      resource: apiResource(deps.apiBaseUrl),
      endpoints: endpoints.value,
    },
  };
}
