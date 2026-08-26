import type { RequestOptions } from "~/shell/platform/createTrpcClient.js";

/**
 * Runner endpoints are answered by a live runner doing the work — starting a
 * browser, evaluating a snippet, capturing a screen — not by the platform's
 * database, so the client's default timeout is too short for them. The slowest
 * case is a first action that has to start the browser: the platform waits up
 * to sixty seconds for that boot, and this timeout must outlive that wait or
 * the client gives up first.
 */
export const runnerCallOptions: RequestOptions = { timeoutMs: 90_000 };
