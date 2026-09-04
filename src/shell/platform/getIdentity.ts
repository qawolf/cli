import { type IdentityResponse, identityResponse } from "@qawolf/api-contracts";
import { isTimeoutError } from "~/core/errors.js";
import type { WireResult } from "./createTrpcClient.js";
import { toError } from "./toError.js";
import { readOrganizations, type Organization } from "./organizations.js";

export type TeamIdentity = Extract<IdentityResponse, { team: unknown }>["team"];

/**
 * The identity contract plus the workspaces the caller can reach. The list is
 * read alongside the contract rather than through it, because the published
 * contract does not declare the field yet.
 */
export type Identity = IdentityResponse & { organizations: Organization[] };

type GetIdentityDeps = {
  fetch: typeof globalThis.fetch;
  baseUrl: string;
};

const timeoutMs = 10_000;

export async function getIdentity(
  apiKey: string,
  deps: GetIdentityDeps,
): Promise<WireResult<Identity>> {
  const url = `${deps.baseUrl}/api/v0/identity`;

  let response: Response;
  try {
    response = await deps.fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    if (isTimeoutError(error)) {
      return { ok: false, error: { kind: "timeout", timeoutMs } };
    }
    return {
      ok: false,
      error: { kind: "network", cause: toError(error) },
    };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      error: { kind: "http", status: response.status, body },
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (error: unknown) {
    if (isTimeoutError(error)) {
      return { ok: false, error: { kind: "timeout", timeoutMs } };
    }
    json = undefined;
  }

  const parsed = identityResponse.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: { kind: "parse", cause: parsed.error } };
  }

  return {
    ok: true,
    data: { ...parsed.data, organizations: readOrganizations(json) },
  };
}
