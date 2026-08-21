import {
  type RunSelection,
  runSelectionSchema,
} from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { interactiveRunnerMessages } from "~/core/messages/index.js";

export type BuiltRunSelection =
  | { ok: true; selection: RunSelection }
  | { ok: false; error: string };

const lineRangePattern = /^(\d+)\s*-\s*(\d+)$/;

/** One `--lines start-end` range, against the file the lines live in. */
export function buildRunSelection(options: {
  lines: string;
  path: string;
}): BuiltRunSelection {
  const match = lineRangePattern.exec(options.lines.trim());
  if (match === null) {
    return {
      error: interactiveRunnerMessages.malformedLineRange(options.lines),
      ok: false,
    };
  }

  const [, startLine, endLine] = match;
  const parsed = runSelectionSchema.safeParse({
    endLine: Number(endLine),
    path: options.path,
    startLine: Number(startLine),
  });
  if (!parsed.success) {
    return { error: z.prettifyError(parsed.error), ok: false };
  }
  return { ok: true, selection: parsed.data };
}
