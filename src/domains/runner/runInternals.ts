import type { CommandContext } from "~/shell/commandContext.js";
import type { findFlowStamp as defaultFindFlowStamp } from "~/shell/manifest/lookup.js";
import type { Logger } from "~/shell/logger.js";
import type { Reporter } from "~/shell/reporter/types.js";
import type {
  RunAndroidFlowDeps,
  RunAndroidFlowOptions,
  runAndroidFlow as defaultRunAndroidFlow,
} from "./runAndroidFlow.js";
import type {
  RunWebFlowDeps,
  RunWebFlowOptions,
  runWebFlow as defaultRunWebFlow,
} from "./runWebFlow.js";
import type { PooledDispatch } from "./runFlowsPooled.js";
import type {
  BrowserName,
  HarContent,
  HarMode,
  TraceMode,
  VideoMode,
} from "~/core/types.js";
import type { PeekFlowMetaFn } from "~/core/flowMeta.js";

export type FlowsRunFlags = {
  readonly retries: number;
  readonly bail: boolean;
  readonly workers: number;
  readonly timeout: number;
  readonly video: VideoMode;
  readonly trace: TraceMode;
  readonly har: HarMode;
  readonly harContent: HarContent;
  readonly outputDir: string;
  readonly headed: boolean;
  /** `--junit` writes a JUnit XML report. Bare flag (true) uses a default path
   * under outputDir; a string is an explicit output path. */
  readonly junit?: string | boolean;
  // --deps <dir>: use this prepared dependency directory instead of auto-resolving.
  readonly deps?: string;
  // --no-browser-deps: skip Playwright's OS dependency install (Linux --with-deps).
  readonly browserDeps: boolean;
};

export type FlowsRunDeps = {
  readonly peekFlowMeta: PeekFlowMetaFn;
  readonly installBrowsers: (
    ctx: CommandContext,
    browsers: BrowserName[],
  ) => Promise<void>;
  readonly runWebFlow: typeof defaultRunWebFlow;
  readonly runWebFlowDeps: RunWebFlowDeps;
  readonly runAndroidFlow: typeof defaultRunAndroidFlow;
  readonly runAndroidFlowDeps: RunAndroidFlowDeps | "not-wired";
  readonly reporter: Reporter;
  readonly now: () => number;
  readonly findFlowStamp: typeof defaultFindFlowStamp;
  readonly warn: (message: string) => void;
  readonly logger?: Logger;
  /** Builds the subprocess-backed dispatch for `--workers > 1` (pooled path only). */
  readonly createPooledDispatch?: (opts: {
    webOptions: RunWebFlowOptions;
    androidOptions: RunAndroidFlowOptions;
  }) => PooledDispatch;
  /** Boots the AVDs for the given names before any android flows are dispatched. */
  readonly bootAndroid?: (avdNames: string[]) => Promise<void>;
  /** Stops the Appium server and emulator pool after all flows complete. */
  readonly shutdownAndroid?: () => void;
};

export type WebResolvedFlow = {
  readonly kind: "web";
  readonly file: string;
  readonly name: string;
  readonly browser: BrowserName;
};

export type AndroidResolvedFlow = {
  readonly kind: "android";
  readonly file: string;
  readonly name: string;
  readonly target: string;
};

export type ResolvedFlow = WebResolvedFlow | AndroidResolvedFlow;
