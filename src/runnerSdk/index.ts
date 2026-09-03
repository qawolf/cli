import { listRunners } from "~/domains/interactiveRunner/list.js";

import { createSdkContext } from "./createContext.js";
import { createLifecycleVerbs } from "./lifecycleVerbs.js";
import { createPageVerbs } from "./pageVerbs.js";
import { createProjectVerbs } from "./projectVerbs.js";
import { createRunVerbs } from "./runVerbs.js";
import type { ListedRunner, RunnerSdkOptions, SdkResult } from "./types.js";

export type {
  ActRequest,
  EvaluateSnippetRequest,
  EvaluatedSnippet,
  EventsRequest,
  FileSync,
  HighlightRequest,
  HighlightSelectorRequest,
  HighlightedSelector,
  ImportPackageRequest,
  ImportedPackage,
  InspectRequest,
  Inspected,
  Journal,
  JournalWindow,
  KeptAlive,
  LaunchRequest,
  LaunchedRunner,
  LinesLocation,
  ListedRunner,
  PackageVersion,
  PerformedAction,
  PromoteSnapshotRequest,
  PromotedSnapshot,
  RunEnvironment,
  RunFilter,
  RunRequest,
  RunSelection,
  RunnerFamily,
  RunnerRequest,
  RunnerSdkOptions,
  Screenshot,
  SdkResult,
  SnippetScope,
  StoppedRun,
  SubmittedRun,
  TerminatedRunner,
} from "./types.js";

export type RunnerSdk = ReturnType<typeof createRunnerSdk>;

/**
 * Drives interactive runners on the caller's team through the QA Wolf public
 * API. Every verb names the runner it addresses, so nothing is launched or
 * billed implicitly: call `launch` for that.
 */
export function createRunnerSdk(options: RunnerSdkOptions) {
  const context = createSdkContext(options);

  return {
    ...createLifecycleVerbs(context),
    ...createRunVerbs(context),
    ...createPageVerbs(context),
    ...createProjectVerbs(context),

    async list(): Promise<SdkResult<ListedRunner[]>> {
      const listed = await listRunners(context, context.deps);
      return listed.ok
        ? { ok: true, value: listed.items }
        : { error: listed.error, ok: false };
    },
  };
}
