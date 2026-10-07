import {
  type PlaywrightTrace,
  nearestScreenshotForSnapshot,
  readTraceSnapshot,
} from "~/domains/investigation/parser/trace/playwrightTrace.js";

import {
  boundAttemptPageText,
  redactAttemptEvidence,
} from "./attemptEvidenceText.js";
import type { InspectionCommon } from "./inspectAttemptShared.js";
import { serializeSnapshotToHtml } from "~/domains/investigation/parser/snapshot/snapshotHtmlProjection.js";
import {
  projectToText,
  resolveSnapshot,
} from "~/domains/investigation/parser/snapshot/snapshotProjection.js";

const maxSnapshotReconstructionBytes = 256 * 1024;

export function inspectSnapshot(
  trace: PlaywrightTrace,
  common: InspectionCommon,
  target: {
    format?: "html" | "text";
    snapshotId: string;
    type: "snapshot";
  },
) {
  const page = readTraceSnapshot(trace, target.snapshotId, {
    maxBytes: maxSnapshotReconstructionBytes,
  });
  if (!page) {
    return {
      ...common,
      ...(target.format === "html" && { htmlTruncated: false }),
      status: "not-found" as const,
      type: target.type,
    };
  }
  const root = page.truncated ? undefined : resolveSnapshot([page.html], 0);
  const projected = root
    ? boundAttemptPageText(
        redactAttemptEvidence(projectToText(root, Number.MAX_SAFE_INTEGER)),
      )
    : { text: "", truncated: true };
  const nearest = nearestScreenshotForSnapshot(trace, target.snapshotId);
  const serializedHtml =
    target.format === "html" && root
      ? serializeSnapshotToHtml(root)
      : undefined;
  return {
    ...common,
    ...(nearest && {
      nearestScreenshot: {
        deltaMilliseconds: nearest.deltaMilliseconds,
        relationship: nearest.relationship,
        screenshot: {
          height: nearest.screenshot.height,
          pageId: nearest.screenshot.pageId,
          screenshotId: nearest.screenshot.id,
          timestampMilliseconds: nearest.screenshot.timestamp,
          width: nearest.screenshot.width,
        },
      },
    }),
    snapshot: {
      actionId: page.snapshot.actionId,
      frameId: page.snapshot.frameId,
      isMainFrame: page.snapshot.isMainFrame,
      pageId: page.snapshot.pageId,
      phase: page.snapshot.phase,
      snapshotId: page.snapshot.id,
      url: redactAttemptEvidence(page.snapshot.url),
    },
    status: "available" as const,
    text: projected.text,
    textTruncated: page.truncated || projected.truncated,
    ...(target.format === "html" && {
      ...(serializedHtml && { html: serializedHtml.html }),
      htmlTruncated: page.truncated || (serializedHtml?.truncated ?? false),
    }),
    type: target.type,
  };
}
