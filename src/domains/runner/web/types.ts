import type { BrowserName, TraceMode, VideoMode } from "~/core/types.js";

type BrowserLaunchOptions = {
  headless: boolean;
  slowMo: number;
  executablePath?: string;
};

export type ContextSetupOptions = {
  viewport?: { width: number; height: number };
  screen?: { width: number; height: number };
  recordVideo?: { dir: string; size: { width: number; height: number } };
};

type MinimalTracingHandle = {
  start(opts: { screenshots: boolean; snapshots: boolean }): Promise<void>;
  stop(opts?: { path?: string }): Promise<void>;
};

export type MinimalVideo = {
  path(): Promise<string>;
  delete(): Promise<void>;
};

export type MinimalPage = {
  video(): MinimalVideo | undefined;
};

export type MinimalBrowserContext = {
  setDefaultTimeout(ms: number): void;
  close(): Promise<void>;
  pages(): MinimalPage[];
  tracing: MinimalTracingHandle;
  newPage(): Promise<MinimalPage>;
};

export type MinimalBrowser = {
  newContext(opts: ContextSetupOptions): Promise<MinimalBrowserContext>;
  close(): Promise<void>;
};

export type BrowserDep = {
  launch(opts: BrowserLaunchOptions): Promise<MinimalBrowser>;
  launchPersistentContext(
    userDataDir: string,
    opts: BrowserLaunchOptions & ContextSetupOptions,
  ): Promise<MinimalBrowserContext>;
};

export type WebLaunchDeps = {
  chromium: BrowserDep;
  firefox: BrowserDep;
  webkit: BrowserDep;
};

export type WebLaunchOptions = {
  browser: BrowserName;
  headed: boolean;
  slowMo: number;
  executablePath?: string;
  video: VideoMode;
  trace: TraceMode;
  outputDir: string;
  timeout: number;
  artifactDir?: string;
};

export type LaunchCallOptions = {
  browserContext?: "persistent";
  userDataDir?: string;
};

export type CleanupResult = {
  videoPaths: string[];
  tracePaths: string[];
};

export type WebLaunchContext = {
  launch(opts?: LaunchCallOptions): Promise<void>;
  pages(): MinimalPage[];
  cleanup(passed: boolean): Promise<CleanupResult>;
};
