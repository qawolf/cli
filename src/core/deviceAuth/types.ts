/**
 * What the token endpoint hands back, as far as the CLI keeps it. No email:
 * a Connect token response is a plain OAuth one, and who the person is comes
 * from the API once it has accepted the token.
 */
export type DeviceTokens = {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms; absent when the token carried no readable expiry. */
  expiresAt: number | undefined;
  /**
   * WorkOS organization the token is scoped to, read from its `org_id` claim.
   * The API confines the session to it, so it is kept to show which one was
   * granted and to notice when a refresh lands somewhere else.
   */
  organizationId: string | undefined;
};

/** One token-endpoint answer, already narrowed from its OAuth error code. */
export type PollResponse =
  | { kind: "tokens"; tokens: DeviceTokens }
  | { kind: "pending" }
  | { kind: "slow-down" }
  | { kind: "denied" }
  | { kind: "expired" }
  /** The server answered something unrecognised, or refused outright. */
  | { kind: "error"; detail: string }
  /**
   * The server never gave a usable answer — unreachable, or failing with a 5xx
   * or 429. Transient either way, so worth retrying.
   */
  | { kind: "unreachable"; detail: string };

export type PollState = {
  intervalMs: number;
  /** Epoch ms the device code stops being redeemable. */
  deadlineMs: number;
};

type PollFailure = "access-denied" | "expired" | "timeout" | "network";

export type PollStep =
  | { action: "poll"; delayMs: number; state: PollState }
  | { action: "done"; tokens: DeviceTokens }
  | { action: "fail"; reason: PollFailure; detail: string | undefined };

/** What the authorization endpoint hands back to start a flow. */
export type DeviceAuthorization = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  /** Verification URI with the user code prefilled, when the server sent one. */
  verificationUriComplete: string | undefined;
  expiresInSec: number;
  intervalSec: number;
};
