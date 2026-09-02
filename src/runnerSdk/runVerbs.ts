import { prepareRun } from "~/domains/interactiveRunner/prepareRun.js";
import { readJournal } from "~/domains/interactiveRunner/readJournal.js";
import { submitRun } from "~/domains/interactiveRunner/submitRun.js";

import type { SdkContext } from "./createContext.js";
import type {
  EventsRequest,
  Journal,
  RunRequest,
  RunSelection,
  SdkResult,
  SubmittedRun,
} from "./types.js";

function toLineRange(selection: RunSelection): string | undefined {
  return selection === "whole-flow"
    ? undefined
    : `${selection.startLine}-${selection.endLine}`;
}

function toLinesFile(selection: RunSelection): string | undefined {
  if (selection === "whole-flow" || selection.linesIn === "entry-point")
    return undefined;
  return selection.linesIn.filePath;
}

export function createRunVerbs({ deps, platformClient }: SdkContext) {
  const ctx = { platformClient };

  return {
    async events({
      runFilter,
      runnerId,
      stream,
      window,
    }: EventsRequest): Promise<SdkResult<Journal>> {
      const read = await readJournal(ctx, runnerId, {
        stream,
        ...(runFilter === "all-runs" ? {} : { runId: runFilter.runId }),
        ...(window === "newest"
          ? {}
          : "tail" in window
            ? { tail: window.tail }
            : { sinceSequence: window.sinceSequence }),
      });

      if (read.type === "read") return { ok: true, value: read.value };
      return {
        error:
          read.type === "unreachable"
            ? "The runner could not be reached."
            : read.error,
        ok: false,
      };
    },

    async run({
      entryPointPath,
      environment,
      runnerId,
      selection,
    }: RunRequest): Promise<SdkResult<SubmittedRun>> {
      const prepared = await prepareRun(
        {
          entryPointPath,
          envFile: undefined,
          envId: environment === "ambient" ? undefined : environment.id,
          lines: toLineRange(selection),
          linesFile: toLinesFile(selection),
        },
        deps,
      );
      if (!prepared.ok) return { error: prepared.error, ok: false };

      const submitted = await submitRun(
        ctx,
        {
          entryPointPath,
          environment: prepared.environment,
          environmentId: prepared.environmentId,
          files: prepared.files,
          resolved: { runnerId, type: "resolved" },
          selection: prepared.selection,
        },
        deps,
      );
      if (!submitted.ok) return { error: submitted.error, ok: false };

      return {
        ok: true,
        value: {
          bootstrappedRunner: submitted.bootstrappedRunner,
          fileSync: submitted.fileSync,
          runId: submitted.runId,
        },
      };
    },
  };
}
