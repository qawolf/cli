import type { RequestOptions } from "~/shell/platform/createTrpcClient.js";

/**
 * How long the CLI waits for a sequence to answer.
 *
 * One request covers a browser start, then every action back to back, then a
 * frame, so it is given far longer than a single action gets. Giving up early
 * loses an answer that is still being assembled, and the actions have taken
 * effect either way.
 */
export const sequenceCallOptions: RequestOptions = { timeoutMs: 180_000 };
