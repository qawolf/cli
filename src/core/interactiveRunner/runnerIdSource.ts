import type { IdSource } from "~/core/resolveId.js";

/**
 * Where the runner a command drives was named: the three levels `resolveIdFrom`
 * picks between, the runner the CLI started because none of them named one, and
 * the id an SDK caller passed in directly.
 */
export type RunnerIdSource = IdSource | "launched" | "given";
