import { randomUUID } from "node:crypto";

/**
 * The id a runner launched on the caller's behalf gets, generated here rather
 * than by the server so that a launch is idempotent: the same id resubmitted
 * attaches to the runner already running under it instead of paying for a
 * second one.
 *
 * Prefixed so a team reading its own runner ids can tell which were named by a
 * person and which the CLI minted. Narrow enough for `runnerIdSchema`, which
 * admits lowercase letters, digits and dashes only.
 */
export function makeRunnerId(): string {
  return `cli-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}
