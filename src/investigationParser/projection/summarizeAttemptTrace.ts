// oxlint-disable eslint/max-lines -- Keep summary selection and cross-evidence attribution aligned with the platform implementation.

import {
  type PlaywrightTrace,
  listTraceActionLogs,
  listTraceActions,
  listTraceConsole,
  listTraceNetwork,
  listTraceSnapshots,
  nearestScreenshotForSnapshot,
  readFailureStack,
  readTraceSnapshot,
} from "../trace/playwrightTrace.js";

import {
  boundAttemptPageText,
  redactAndBoundAttemptEvidenceResult,
  redactAttemptEvidence,
} from "./attemptEvidenceText.js";
import { chronologicallySortActions } from "./chronologicallySortActions.js";
import {
  projectToText,
  resolveSnapshot,
} from "../snapshot/snapshotProjection.js";
import { summarizeAttemptNetworkErrors } from "./summarizeAttemptNetwork.js";
import { summarizeAttemptWaitingLogs } from "./summarizeAttemptWaitingLogs.js";

const evidenceLimit = 10;
const maxSnapshotReconstructionBytes = 256 * 1024;

function normalizedFailure(value: string): string {
  return redactAttemptEvidence(value).replace(/\s+/g, " ").trim();
}

export async function summarizeAttemptTrace(
  trace: PlaywrightTrace,
  attemptError: string | undefined,
) {
  const actions = listTraceActions(trace, { limit: Number.MAX_SAFE_INTEGER });
  const logs = listTraceActionLogs(trace, {
    limit: Number.MAX_SAFE_INTEGER,
    maxTextBytes: Number.MAX_SAFE_INTEGER,
  });
  const failure = readFailureStack(trace);
  const traceError = failure?.errorMessage
    ? normalizedFailure(failure.errorMessage)
    : undefined;
  const metadataError = attemptError
    ? normalizedFailure(attemptError)
    : undefined;
  const errorMatches = Boolean(
    traceError &&
    metadataError &&
    (metadataError.includes(traceError) || traceError.includes(metadataError)),
  );
  const toAction = (action: (typeof actions.items)[number]) => {
    const stack =
      failure?.action.id === action.id
        ? failure.frames.map((frame) => `${frame.file}:${frame.compiledLine}`)
        : [];
    return {
      actionId: action.id,
      apiName: action.apiName,
      ...(action.endTime !== undefined && {
        endedAtMilliseconds: action.endTime,
      }),
      ...(action.startTime !== undefined && {
        startedAtMilliseconds: action.startTime,
      }),
      stack: stack.slice(0, 20),
      stackTruncated: stack.length > 20,
      ...summarizeAttemptWaitingLogs(logs, action.id),
    };
  };
  const completed = chronologicallySortActions(
    actions.items.filter((action) => action.endTime !== undefined),
  );
  const selectedActions = completed.slice(-evidenceLimit);
  const lastCompleted = completed.at(-1);
  const allConsoleEntries = listTraceConsole(trace, {
    limit: Number.MAX_SAFE_INTEGER,
    maxTextBytes: Number.MAX_SAFE_INTEGER,
  });
  const consoleItems = allConsoleEntries.items.slice(-evidenceLimit);
  const consoleSummaries = consoleItems.map((entry) => ({
    entry,
    message: redactAndBoundAttemptEvidenceResult(entry.message, 1024),
  }));
  const network = await listTraceNetwork(trace, {
    limit: Number.MAX_SAFE_INTEGER,
  });
  const networkErrors = summarizeAttemptNetworkErrors(network);
  const snapshots = listTraceSnapshots(trace, {
    limit: Number.MAX_SAFE_INTEGER,
  });
  const pageAction = errorMatches ? failure?.action : lastCompleted;
  const actionSnapshots = snapshots.items.filter(
    (snapshot) =>
      snapshot.phase === "after" &&
      snapshot.actionId === pageAction?.id &&
      (pageAction?.pageId === undefined ||
        snapshot.pageId === pageAction.pageId),
  );
  const mainFrameSnapshot = actionSnapshots.find(
    (snapshot) => snapshot.isMainFrame === true,
  );
  const actionFrameIds = new Set(
    actionSnapshots.map((snapshot) => snapshot.frameId),
  );
  const onlyFrameSnapshot =
    actionFrameIds.size === 1 ? actionSnapshots.at(-1) : undefined;
  const fallbackSnapshot = snapshots.items.findLast(
    (snapshot) =>
      snapshot.phase === "after" &&
      snapshot.isMainFrame === true &&
      (pageAction?.pageId === undefined ||
        snapshot.pageId === pageAction.pageId),
  );
  const pageSnapshot =
    mainFrameSnapshot ?? onlyFrameSnapshot ?? fallbackSnapshot;
  const selectionBasis = mainFrameSnapshot
    ? ("action-main-frame" as const)
    : onlyFrameSnapshot
      ? ("action-only-frame" as const)
      : ("page-main-frame-fallback" as const);
  const page = pageSnapshot
    ? readTraceSnapshot(trace, pageSnapshot.id, {
        maxBytes: maxSnapshotReconstructionBytes,
      })
    : undefined;
  const screenshot = pageSnapshot
    ? nearestScreenshotForSnapshot(trace, pageSnapshot.id)
    : undefined;
  const projectedPage = page
    ? boundAttemptPageText(
        redactAttemptEvidence(
          projectToText(
            resolveSnapshot([page.html], 0),
            Number.MAX_SAFE_INTEGER,
          ),
        ),
      )
    : undefined;

  return {
    actions: {
      coverage: {
        ...actions.coverage,
        returned: selectedActions.length,
        truncated: actions.coverage.total > selectedActions.length,
      },
      items: selectedActions.map(toAction),
    },
    browserConsole: {
      coverage: {
        ...allConsoleEntries.coverage,
        returned: consoleSummaries.length,
        truncated:
          allConsoleEntries.coverage.truncated ||
          allConsoleEntries.coverage.total > consoleSummaries.length ||
          consoleSummaries.some(({ message }) => message.truncated),
      },
      items: consoleSummaries.map(({ entry, message }) => ({
        evidenceId: entry.id,
        message: message.text,
        type: entry.type,
      })),
    },
    ...(errorMatches &&
      failure && {
        failedBrowserAction: toAction(failure.action),
      }),
    failedBrowserActionAttribution: errorMatches
      ? ("trace-error-matches-attempt" as const)
      : ("none" as const),
    ...(!errorMatches &&
      lastCompleted && { lastCompletedBrowserAction: toAction(lastCompleted) }),
    networkErrors,
    ...(page &&
      projectedPage &&
      pageSnapshot && {
        pageState: {
          frameId: pageSnapshot.frameId,
          isMainFrame: pageSnapshot.isMainFrame,
          pageId: pageSnapshot.pageId,
          phase: pageSnapshot.phase,
          screenshotRelationship:
            screenshot?.relationship ?? ("unknown" as const),
          ...(screenshot && { screenshotId: screenshot.screenshot.id }),
          selectionBasis,
          snapshotId: pageSnapshot.id,
          text: projectedPage.text,
          truncated: page.truncated || projectedPage.truncated,
          url: redactAttemptEvidence(pageSnapshot.url),
        },
      }),
  };
}
