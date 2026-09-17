import { authMessages } from "~/core/messages/index.js";
import type { NotFoundSubject } from "~/core/publicApi/notFoundSubject.js";
import { exitCodes } from "~/shell/exit.js";

import type { PlatformFailure } from "./requestWithRetry.js";

const m = authMessages.errors.request;

/**
 * A server reason that only repeats what the status already said. Dropping it
 * leaves room for wording a reader can act on, and a server that names the
 * missing thing instead (WIZ-12139) is preferred over anything invented here.
 */
const saysNothingMore = (reason: string): boolean =>
  /^not ?found\.?$/i.test(reason.trim());

/**
 * How a 404 reads: the request's own subject, not the environment. Only a route
 * that actually resolves an environment keeps the wording that blames one, and
 * a caller with no subject at all is one of the environment-scoped reads.
 */
export function describeNotFound(
  subject: NotFoundSubject | undefined,
  noun: string | undefined,
  reason: string,
): PlatformFailure {
  const explain = (error: string, fallback: string): PlatformFailure => {
    const detail = reason && !saysNothingMore(reason) ? reason : fallback;
    return {
      error,
      exitCode: exitCodes.notFound,
      ...(detail ? { errorBody: detail } : {}),
    };
  };

  switch (subject?.kind) {
    case "runner":
      return explain(m.notFound404Runner(subject.runnerId), m.runnerIsGone);
    case "run":
      return explain(
        m.notFound404Run(subject.runId),
        m.runIdMayBeRunnerLocal(subject.runId),
      );
    case "other":
      return explain(m.notFound404(noun), "");
    // A caller that named no subject is one of the environment-scoped reads:
    // the flow bundle, an environment's variables, the team's storage.
    case "environment":
    case undefined:
      return explain(m.notFound404Environment(noun), "");
  }
}
