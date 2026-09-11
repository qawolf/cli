import type { publicContractsV1 } from "@qawolf/api-contracts/v1";
import type { z } from "zod";

type InspectMobileOutput = z.infer<
  typeof publicContractsV1.runner.inspectMobile.output
>;
export type InspectMobileSuccess = Extract<
  InspectMobileOutput,
  { outcome: "success" }
>;
type SessionStatus = Extract<
  InspectMobileSuccess,
  { what: "session" }
>["session"];

/** A one-line summary of `--what session`, one branch per session state. */
export function describeSession(session: SessionStatus): string {
  switch (session.type) {
    case "ready":
      return session.deviceName === undefined
        ? `Session ready: ${session.platformName} (${session.sessionId}).`
        : `Session ready: ${session.platformName} on ${session.deviceName} (${session.sessionId}).`;
    case "unreachable":
      return `Session unreachable: ${session.error}`;
    case "ambiguous":
      return `${String(session.sessionCount)} Appium sessions are live; expected one.`;
    case "no-session":
      return "No Appium session is live.";
  }
}

/**
 * The answer as JSON, on its own, so a caller can redirect or pipe it — same
 * reasoning as `inspect.ts` streaming `value.value`. `session` skips this:
 * its `describeSession` line is the whole answer.
 */
export function streamLine(
  value: Exclude<InspectMobileSuccess, { what: "session" }>,
): string {
  switch (value.what) {
    case "contexts":
      return JSON.stringify({
        contexts: value.contexts,
        current: value.current,
      });
    case "page":
      return JSON.stringify({
        context: value.context,
        orientation: value.orientation,
        pageSource: value.pageSource,
      });
    case "elements":
      return JSON.stringify({ matches: value.matches });
  }
}
