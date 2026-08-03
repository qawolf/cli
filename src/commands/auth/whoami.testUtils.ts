import { mock } from "bun:test";
import type { ApiKeyResult } from "~/domains/auth/types.js";
import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";
import type {
  IdentityResponse,
  TeamIdentity,
} from "~/shell/platform/getIdentity.js";
import type { PlatformResult } from "~/shell/platform/requestWithRetry.js";

function makeTeam(): TeamIdentity {
  return {
    id: "t1",
    name: "Acme Corp",
    slug: "acme",
    createdAt: "2024-01-01T00:00:00.000Z",
  };
}

export function makeDeps(
  overrides: {
    requireApiKey?: () => Promise<ApiKeyResult>;
    getIdentity?: () => Promise<PlatformResult<IdentityResponse>>;
  } = {},
) {
  const getIdentity =
    overrides.getIdentity ??
    mock(() =>
      Promise.resolve({
        ok: true as const,
        value: { team: makeTeam() },
      }),
    );
  return {
    requireApiKey:
      overrides.requireApiKey ??
      mock(() => Promise.resolve({ key: "test-key", source: "env" as const })),
    createPlatform: mock(() => ({ getIdentity }) as unknown as PlatformClient),
  };
}
