import type { RequestOptions } from "~/shell/platform/createTrpcClient.js";

/**
 * A sequence is one request that the platform holds open for up to about
 * 170 seconds: a browser start, then the actions, then a frame. The client's
 * own timeout must outlive that, or it gives up on an answer the platform is
 * still assembling.
 */
export const sequenceCallOptions: RequestOptions = { timeoutMs: 180_000 };
