import { describeIdentityError } from "./describeErrors.js";
import { getAccessibleOrganizations } from "./getAccessibleOrganizations.js";
import { getIdentity, type Identity } from "./getIdentity.js";
import type { Organization } from "./organizations.js";
import { type PlatformResult, requestWithRetry } from "./requestWithRetry.js";

type Deps = {
  fetch: typeof globalThis.fetch;
  baseUrl: string;
  sleep?: (ms: number) => Promise<void>;
};

export type IdentityMethods = {
  getIdentity: () => Promise<PlatformResult<Identity>>;
  getAccessibleOrganizations: () => Promise<PlatformResult<Organization[]>>;
};

/**
 * The two ways to ask the API who the caller is.
 *
 * `getIdentity` answers what the credential is and the organizations it belongs
 * to, cheaply enough to read on any command. `getAccessibleOrganizations`
 * answers the wider question of what the caller may act on, including admin and
 * QA Wolf employee reach, and is read only when offering a workspace choice.
 */
export function createIdentityMethods(
  apiKey: string,
  deps: Deps,
  backoffMs: readonly number[],
): IdentityMethods {
  return {
    getIdentity: () =>
      requestWithRetry({
        call: () => getIdentity(apiKey, deps),
        backoffMs,
        describe: describeIdentityError,
        sleep: deps.sleep,
      }),

    getAccessibleOrganizations: () =>
      requestWithRetry({
        call: () => getAccessibleOrganizations(apiKey, deps),
        backoffMs,
        describe: describeIdentityError,
        sleep: deps.sleep,
      }),
  };
}
