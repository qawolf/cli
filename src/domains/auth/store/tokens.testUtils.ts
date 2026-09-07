import type { Entry } from "@napi-rs/keyring";

import type { StoredSession } from "~/domains/auth/types.js";

export const tokens: StoredSession = {
  accessToken: "access_abc",
  refreshToken: "refresh_abc",
  expiresAt: 1_700_000_000_000,
  email: "person@example.com",
  organizationId: "org_1",
  workspaceId: "ws_1",
  issuer: "https://signin.example",
  clientId: "client_1",
  resource: "https://app.example/api",
};

export function makeEntryClass(getPassword: () => string): typeof Entry {
  return class {
    getPassword = getPassword;
  } as unknown as typeof Entry;
}

export function makeThrowingEntryClass(message: string): typeof Entry {
  return class {
    constructor(_service: string, _account: string) {
      throw Error(message);
    }
    getPassword(): string {
      throw Error("unreachable");
    }
  } as unknown as typeof Entry;
}
