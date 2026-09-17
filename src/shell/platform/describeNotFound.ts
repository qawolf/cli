import { authMessages } from "~/core/messages/index.js";
import type { NotFoundSubject } from "~/core/publicApi/notFoundSubject.js";
import { exitCodes } from "~/shell/exit.js";

import type { PlatformFailure } from "./requestWithRetry.js";

const m = authMessages.errors.request;

/**
 * A server reason that only repeats what the status already said, including the
 * "<Noun> not found" apex answers for several routes. Dropping it leaves room
 * for wording a reader can act on.
 */
const saysNothingMore = (reason: string): boolean =>
  /^(\w+ )*not ?found\.?$/i.test(reason.trim());

/** What the CLI says about a 404 when the platform explained nothing. */
type OwnWording = {
  /** The line that stands in for a reason. */
  statement: string;
  /** Why it happened. A guess, so it is dropped once the platform says. */
  guess?: string;
  /** What to do about it, true whatever the reason turns out to be. */
  guidance?: string;
};

/**
 * How a 404 reads: the request's own subject, not the environment. Only a route
 * that actually resolves an environment keeps the wording that blames one, and
 * a caller with no subject at all is one of the environment-scoped reads.
 *
 * The platform's own reason leads when it has one. It knows things this layer
 * can only guess at — a run that answers 404 because it is still being created
 * clears by waiting, which no wording invented here would have said.
 */
export function describeNotFound(
  subject: NotFoundSubject | undefined,
  noun: string | undefined,
  reason: string,
): PlatformFailure {
  const explained = reason && !saysNothingMore(reason) ? reason : undefined;
  const say = (own: OwnWording): PlatformFailure => {
    const body = [explained ? undefined : own.guess, own.guidance].filter(
      (line) => line,
    );
    return {
      error: explained ? `${explained} (HTTP 404)` : own.statement,
      exitCode: exitCodes.notFound,
      ...(body.length > 0 ? { errorBody: body.join("\n") } : {}),
    };
  };

  switch (subject?.kind) {
    case "runner":
      return say({
        guess: m.runnerIsGone,
        guidance: m.launchTheRunner(subject.runnerId),
        statement: m.notFound404Runner(subject.runnerId),
      });
    case "run":
      return say({
        guess: m.runIdMayBeRunnerLocal(subject.runId),
        statement: m.notFound404Run(subject.runId),
      });
    case "record":
      return say({ statement: m.notFound404Record(subject.noun, subject.id) });
    case "other":
      return say({ statement: m.notFound404(noun) });
    // A caller that named no subject is one of the environment-scoped reads:
    // the flow bundle, an environment's variables, the team's storage.
    case "environment":
    case undefined:
      return say({ statement: m.notFound404Environment(noun) });
  }
}
