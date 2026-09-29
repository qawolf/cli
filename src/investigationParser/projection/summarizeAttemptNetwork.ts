import type { Bounded, TraceNetworkEntry } from "../trace/playwrightTrace.js";

import { redactAndBoundAttemptEvidenceResult } from "./attemptEvidenceText.js";

const evidenceLimit = 10;
const maxNetworkFieldBytes = 2 * 1024;

type SummaryNetworkEntry = TraceNetworkEntry & {
  durationMilliseconds?: number;
  failureText?: string;
  startedAtMilliseconds?: number;
};

export function summarizeAttemptNetworkErrors(
  network: Bounded<TraceNetworkEntry>,
) {
  const errors = (network.items as SummaryNetworkEntry[])
    .map((entry, provenance) => ({ entry, provenance }))
    .filter(
      ({ entry }) =>
        !entry.status || entry.status >= 400 || entry.failureText !== undefined,
    )
    .sort(
      (left, right) =>
        (left.entry.startedAtMilliseconds ?? Number.NEGATIVE_INFINITY) -
          (right.entry.startedAtMilliseconds ?? Number.NEGATIVE_INFINITY) ||
        left.provenance - right.provenance,
    )
    .map(({ entry }) => entry);
  const summaries = errors.slice(-evidenceLimit).map((entry) => {
    const url = redactAndBoundAttemptEvidenceResult(
      entry.url,
      maxNetworkFieldBytes,
    );
    const failureText =
      entry.failureText !== undefined
        ? redactAndBoundAttemptEvidenceResult(
            entry.failureText,
            maxNetworkFieldBytes,
          )
        : undefined;
    return {
      item: {
        ...(entry.durationMilliseconds !== undefined && {
          durationMilliseconds: entry.durationMilliseconds,
        }),
        ...(failureText && { failureText: failureText.text }),
        method: entry.method,
        requestId: entry.id,
        ...(entry.startedAtMilliseconds !== undefined && {
          startedAtMilliseconds: entry.startedAtMilliseconds,
        }),
        status: entry.status,
        url: url.text,
      },
      truncated: url.truncated || failureText?.truncated === true,
    };
  });
  const items = summaries.map(({ item }) => item);
  const upstreamLimited =
    network.coverage.incomplete || network.coverage.truncated;
  return {
    coverage: {
      ...network.coverage,
      returned: items.length,
      total: upstreamLimited ? network.coverage.total : errors.length,
      truncated:
        upstreamLimited ||
        errors.length > items.length ||
        summaries.some(({ truncated }) => truncated),
    },
    items,
  };
}
