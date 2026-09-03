import type {
  BrowserAction,
  InspectOnRunnerRequest,
  JournalStream,
  PublicApiOutput,
  ReadJournalResponse,
  RunnerNameForPublicApi,
  publicContractsV1,
} from "@qawolf/api-contracts/v1";

type Runner = typeof publicContractsV1.runner;

export type RunnerSdkOptions = {
  /** A QA Wolf team API key. The SDK never reads the CLI's stored credentials. */
  apiKey: string;
  /** Defaults to `QAWOLF_HOST_URL`, then `https://app.qawolf.com`. */
  baseUrl?: string | undefined;
  /** Where a run collects its files from. Defaults to `process.cwd()`. */
  cwd?: string | undefined;
  fetch?: typeof globalThis.fetch | undefined;
};

export type SdkResult<Value> =
  | { error: string; ok: false }
  | { ok: true; value: Value };

export type RunSelection =
  | "whole-flow"
  | { endLine: number; linesIn: LinesLocation; startLine: number };

export type LinesLocation = "entry-point" | { filePath: string };

export type RunEnvironment = "ambient" | { id: string };

export type SnippetScope = "no-imports" | { filePath: string };

export type HighlightRequest = "clear" | { selector: string };

export type PackageVersion = "latest" | { exact: string };

export type RunnerFamily = "default" | { name: RunnerNameForPublicApi };

export type JournalWindow =
  | "newest"
  | { sinceSequence: number }
  | { tail: number };

export type RunFilter = "all-runs" | { runId: string };

export type LaunchRequest = { id: string; runnerFamily: RunnerFamily };

export type RunnerRequest = { runnerId: string };

export type RunRequest = RunnerRequest & {
  entryPointPath: string;
  environment: RunEnvironment;
  selection: RunSelection;
};

export type EventsRequest = RunnerRequest & {
  runFilter: RunFilter;
  stream: JournalStream;
  window: JournalWindow;
};

export type ActRequest = RunnerRequest & { action: BrowserAction };

export type EvaluateSnippetRequest = RunnerRequest & {
  scope: SnippetScope;
  source: string;
};

export type InspectRequest = RunnerRequest & {
  request: InspectOnRunnerRequest;
};

export type ImportPackageRequest = RunnerRequest & {
  name: string;
  version: PackageVersion;
};

export type HighlightSelectorRequest = RunnerRequest & {
  highlight: HighlightRequest;
};

export type PromoteSnapshotRequest = RunnerRequest & {
  baselinePath: string;
  screenshotPath: string;
};

export type LaunchedRunner = PublicApiOutput<Runner["launch"]>;
export type TerminatedRunner = PublicApiOutput<Runner["terminate"]>;
export type StoppedRun = PublicApiOutput<Runner["stopRun"]>;
export type Screenshot = PublicApiOutput<Runner["takeScreenshot"]>;
export type PerformedAction = PublicApiOutput<Runner["performAction"]>;
export type EvaluatedSnippet = PublicApiOutput<Runner["evaluateSnippet"]>;
export type Inspected = PublicApiOutput<Runner["inspect"]>;
export type ImportedPackage = PublicApiOutput<Runner["importPackage"]>;
export type HighlightedSelector = PublicApiOutput<Runner["highlightSelector"]>;
export type PromotedSnapshot = PublicApiOutput<Runner["promoteSnapshot"]>;

/** A journal window, as the public API answers it. */
export type Journal = ReadJournalResponse;

/** The CLI's own answer: the file set it sent whole, or only what changed. */
export type FileSync = "delta" | "full";

/**
 * `fileSync` and `bootstrappedRunner` are the CLI's own, so this is not the
 * `runner.runFlow` output verbatim.
 */
export type SubmittedRun = {
  bootstrappedRunner: boolean;
  fileSync: FileSync;
  runId: string;
};

/** Runners this working directory launched, which the API has no notion of. */
export type ListedRunner = {
  id: string;
  isDefault: boolean;
  runnerName: string | undefined;
};

export type KeptAlive = { id: string };
