import type { RequestOptions } from "~/shell/platform/createTrpcClient.js";

/**
 * Runner endpoints are answered by a live runner doing the work — starting a
 * browser, evaluating a snippet, capturing a screen — not by the platform's
 * database, so the client's default timeout is too short for them. Sixty
 * seconds covers the slowest observed case, a first action that has to start
 * the browser before it can be performed.
 */
export const runnerCallOptions: RequestOptions = { timeoutMs: 60_000 };
