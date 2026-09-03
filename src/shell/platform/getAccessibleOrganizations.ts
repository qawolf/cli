import { isTimeoutError } from "~/core/errors.js";
import type { WireResult } from "./createTrpcClient.js";
import {
  type Organization,
  parseOrganizationsResponse,
} from "./organizations.js";
import { toError } from "./toError.js";

type Deps = {
  fetch: typeof globalThis.fetch;
  baseUrl: string;
};

const timeoutMs = 10_000;

/**
 * Every organization the caller may act on, which is a wider set than the
 * identity response carries.
 *
 * Identity lists membership only, because a client reads it on every command.
 * This applies the admin and QA Wolf employee reach as well, so it is read only
 * when the CLI offers a workspace choice. An employee's customer workspaces
 * appear here and nowhere else.
 */
export async function getAccessibleOrganizations(
  apiKey: string,
  deps: Deps,
): Promise<WireResult<Organization[]>> {
  const url = `${deps.baseUrl}/api/v0/identity/organizations`;

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
    return { ok: false, error: { kind: "network", cause: toError(error) } };
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

  const organizations = parseOrganizationsResponse(json);
  if (!organizations) {
    return {
      ok: false,
      error: { kind: "http", status: response.status, body: "unexpected body" },
    };
  }

  return { ok: true, data: organizations };
}
